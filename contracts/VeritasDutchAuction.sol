// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VeritasFactory.sol";
import "./VeritasMarket.sol";

/// @title VeritasDutchAuction
/// @notice Sealed-bid uniform-price auction for bootstrapping Veritas team-curated markets.
///
/// @dev PHASES
///   1. CommitPhase  — participants submit sealed bids (USDC escrowed)
///   2. RevealPhase  — participants reveal their price/direction
///   3. Finalized    — clearing price computed, VeritasMarket deployed, LP shares held here
///   4. ClaimPhase   — bidders call claimLPShares() to receive their proportional LP position
///
/// PRICE ENCODING
///   pricePercent ∈ [1, 99] represents YES probability in whole percentages.
///   YES bidder at P: "I'll provide liquidity at YES probability = P%"  (filled if clearingPrice ≤ P)
///   NO  bidder at P: "I'll provide liquidity at YES probability = P%"  (filled if clearingPrice ≥ P)
///
/// CLEARING
///   Clearing price P* is the USDC-weighted median revealed price across both sides.
///   ALL filled participants become LPs; their USDC seeds reserveNo and reserveYes proportional to P*.
///   reserveNo  = totalSeed * P* / 100
///   reserveYes = totalSeed * (100 - P*) / 100
///
/// COMMIT HASH
///   keccak256(abi.encodePacked(pricePercent, buyYes, salt, usdcAmount))
///
contract VeritasDutchAuction is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    uint8   public constant MIN_PRICE   = 1;    // 1%  YES probability
    uint8   public constant MAX_PRICE   = 99;   // 99% YES probability
    uint256 public constant MIN_BID     = 1e6;  // $1 USDC minimum bid

    // ─────────────────────────────────────────────
    // Enums / Structs
    // ─────────────────────────────────────────────

    enum AuctionStatus { None, CommitPhase, RevealPhase, Finalized, Cancelled }

    struct Auction {
        string        question;
        uint256       commitDeadline;   // timestamp: end of commit window
        uint256       revealDeadline;   // timestamp: end of reveal window
        uint256       marketDuration;   // seconds: how long the resulting market runs
        AuctionStatus status;
        uint8         clearingPrice;    // set after finalize (1–99)
        address       market;           // VeritasMarket deployed after finalize
        uint256       totalSeed;        // total USDC used to seed the market
        uint256       totalFilled;      // sum of all filled bid amounts
    }

    struct Bid {
        bytes32  commitHash;
        uint256  usdcEscrowed;
        uint8    revealedPrice;         // 0 = not yet revealed
        bool     buyYes;
        bool     revealed;
        bool     claimed;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    IERC20          public immutable usdc;
    VeritasFactory  public immutable factory;

    uint256 public auctionCount;
    mapping(uint256 => Auction)                     public auctions;
    mapping(uint256 => mapping(address => Bid))     public bids;

    // Demand buckets per auction: yesDemand[id][price] = USDC from YES bids at this exact price
    //                              noDemand[id][price]  = USDC from NO  bids at this exact price
    mapping(uint256 => mapping(uint8 => uint256)) public yesDemand;
    mapping(uint256 => mapping(uint8 => uint256)) public noDemand;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event AuctionCreated(
        uint256 indexed id,
        string  question,
        uint256 commitDeadline,
        uint256 revealDeadline
    );
    event Committed(uint256 indexed id, address indexed bidder, uint256 usdcAmount);
    event Revealed(uint256 indexed id, address indexed bidder, uint8 price, bool buyYes);
    event Finalized(
        uint256 indexed id,
        uint8   clearingPrice,
        address market,
        uint256 reserveYes,
        uint256 reserveNo
    );
    event LPSharesClaimed(uint256 indexed id, address indexed bidder, uint256 sharesYes, uint256 sharesNo);
    event Refunded(uint256 indexed id, address indexed bidder, uint256 amount);
    event Cancelled(uint256 indexed id);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(address _usdc, address _factory) Ownable(msg.sender) {
        usdc    = IERC20(_usdc);
        factory = VeritasFactory(_factory);
    }

    // ─────────────────────────────────────────────
    // Auction management  (Veritas team only)
    // ─────────────────────────────────────────────

    /// @notice Create a new Dutch auction for a team-curated market.
    /// @param question        The market question
    /// @param commitDuration  Seconds for the commit phase (min 1 hour)
    /// @param revealDuration  Seconds for the reveal phase (min 1 hour)
    /// @param marketDuration  Seconds the resulting VeritasMarket will run after deployment
    function createAuction(
        string  calldata question,
        uint256 commitDuration,
        uint256 revealDuration,
        uint256 marketDuration
    ) external onlyOwner returns (uint256 id) {
        require(bytes(question).length > 0 && bytes(question).length <= 500, "Bad question");
        require(commitDuration  >= 1 hours,  "Commit phase too short");
        require(revealDuration  >= 1 hours,  "Reveal phase too short");
        require(marketDuration  >= 1 days && marketDuration <= 365 days, "Invalid market duration");

        id = auctionCount++;
        auctions[id] = Auction({
            question:       question,
            commitDeadline: block.timestamp + commitDuration,
            revealDeadline: block.timestamp + commitDuration + revealDuration,
            marketDuration: marketDuration,
            status:         AuctionStatus.CommitPhase,
            clearingPrice:  0,
            market:         address(0),
            totalSeed:      0,
            totalFilled:    0
        });

        emit AuctionCreated(
            id,
            question,
            auctions[id].commitDeadline,
            auctions[id].revealDeadline
        );
    }

    /// @notice Cancel an auction before finalization. Enables full refunds.
    function cancelAuction(uint256 id) external onlyOwner {
        Auction storage a = auctions[id];
        require(a.status != AuctionStatus.Finalized, "Already finalized");
        a.status = AuctionStatus.Cancelled;
        emit Cancelled(id);
    }

    // ─────────────────────────────────────────────
    // Phase 1 — Commit
    // ─────────────────────────────────────────────

    /// @notice Submit a sealed bid. USDC is escrowed immediately.
    ///
    /// @param id          Auction ID
    /// @param commitHash  keccak256(abi.encodePacked(pricePercent, buyYes, salt, usdcAmount))
    /// @param usdcAmount  USDC to bid (6 decimals). Must exactly match the amount hashed.
    ///
    /// One bid per address per auction. Re-bidding is not supported.
    function commit(
        uint256 id,
        bytes32 commitHash,
        uint256 usdcAmount
    ) external nonReentrant {
        Auction storage a = auctions[id];
        require(a.status == AuctionStatus.CommitPhase, "Not in commit phase");
        require(block.timestamp <= a.commitDeadline,   "Commit phase ended");
        require(usdcAmount >= MIN_BID,                 "Below minimum bid");
        require(bids[id][msg.sender].usdcEscrowed == 0, "Already committed");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        bids[id][msg.sender] = Bid({
            commitHash:    commitHash,
            usdcEscrowed:  usdcAmount,
            revealedPrice: 0,
            buyYes:        false,
            revealed:      false,
            claimed:       false
        });

        emit Committed(id, msg.sender, usdcAmount);
    }

    // ─────────────────────────────────────────────
    // Phase 2 — Reveal
    // ─────────────────────────────────────────────

    /// @notice Reveal a sealed bid. Must reproduce the committed hash exactly.
    ///         Automatically transitions to RevealPhase if commitDeadline has passed.
    ///
    /// @param id           Auction ID
    /// @param pricePercent YES probability (1–99)
    /// @param buyYes       true = YES direction, false = NO direction
    /// @param salt         Random bytes32 used when building the commit hash
    /// @param usdcAmount   Must match bid.usdcEscrowed exactly
    function reveal(
        uint256 id,
        uint8   pricePercent,
        bool    buyYes,
        bytes32 salt,
        uint256 usdcAmount
    ) external nonReentrant {
        Auction storage a = auctions[id];

        // Allow transition CommitPhase → RevealPhase once commit deadline passes
        if (a.status == AuctionStatus.CommitPhase && block.timestamp > a.commitDeadline) {
            a.status = AuctionStatus.RevealPhase;
        }

        require(a.status == AuctionStatus.RevealPhase, "Not in reveal phase");
        require(block.timestamp <= a.revealDeadline,   "Reveal phase ended");
        require(pricePercent >= MIN_PRICE && pricePercent <= MAX_PRICE, "Invalid price");

        Bid storage bid = bids[id][msg.sender];
        require(bid.usdcEscrowed > 0, "No committed bid");
        require(!bid.revealed,        "Already revealed");
        require(usdcAmount == bid.usdcEscrowed, "Amount mismatch");

        // Verify sealed hash
        bytes32 expected = keccak256(abi.encodePacked(pricePercent, buyYes, salt, usdcAmount));
        require(expected == bid.commitHash, "Hash mismatch");

        bid.revealed      = true;
        bid.revealedPrice = pricePercent;
        bid.buyYes        = buyYes;

        // Accumulate into demand bucket
        if (buyYes) {
            yesDemand[id][pricePercent] += usdcAmount;
        } else {
            noDemand[id][pricePercent]  += usdcAmount;
        }

        emit Revealed(id, msg.sender, pricePercent, buyYes);
    }

    // ─────────────────────────────────────────────
    // Phase 3 — Finalize
    // ─────────────────────────────────────────────

    /// @notice Compute clearing price, deploy VeritasMarket, seed it with all filled USDC.
    ///         Callable by anyone once revealDeadline has passed.
    ///
    /// CLEARING ALGORITHM (O(99)):
    ///   CumYesDemand[P] = sum of yesDemand[p] for p ∈ [P, 99]   (YES bidders willing to pay ≥ P)
    ///   CumNoDemand[P]  = sum of noDemand[p]  for p ∈ [1, P]    (NO  bidders willing to accept P)
    ///   P* = USDC-weighted median of all revealed prices (YES + NO), lower median tie-break.
    ///
    ///   Total seed = min(CumYesDemand[P*], CumNoDemand[P*]) * 2  (balanced per side)
    ///   reserveNo  = totalSeed * P* / 100
    ///   reserveYes = totalSeed * (100 - P*) / 100
    function finalize(uint256 id) external nonReentrant {
        Auction storage a = auctions[id];
        require(
            a.status == AuctionStatus.CommitPhase || a.status == AuctionStatus.RevealPhase,
            "Cannot finalize"
        );
        require(block.timestamp > a.revealDeadline, "Reveal phase not ended");
        a.status = AuctionStatus.Finalized;

        // ── Compute cumulative demand curves ─────────────────────────────
        // cumYesAt[p] = total USDC from YES bids with price ≥ p
        // cumNoAt[p]  = total USDC from NO  bids with price ≤ p
        uint256[100] memory cumYesAt;
        uint256[100] memory cumNoAt;

        uint256 runningYes = 0;
        for (uint8 p = MAX_PRICE; p >= MIN_PRICE; p--) {
            runningYes      += yesDemand[id][p];
            cumYesAt[p]      = runningYes;
            if (p == MIN_PRICE) break;
        }

        uint256 runningNo = 0;
        for (uint8 p = MIN_PRICE; p <= MAX_PRICE; p++) {
            runningNo     += noDemand[id][p];
            cumNoAt[p]     = runningNo;
        }

        // ── Find clearing price (USDC-weighted median of revealed prices) ──
        // Default to 50 if there are no revealed bids.
        uint8 cp = 50;
        uint256 totalRevealed = 0;
        for (uint8 p = MIN_PRICE; p <= MAX_PRICE; p++) {
            totalRevealed += yesDemand[id][p] + noDemand[id][p];
        }
        if (totalRevealed > 0) {
            uint256 midpoint = (totalRevealed + 1) / 2; // lower median
            uint256 running = 0;
            for (uint8 p = MIN_PRICE; p <= MAX_PRICE; p++) {
                running += yesDemand[id][p] + noDemand[id][p];
                if (running >= midpoint) {
                    cp = p;
                    break;
                }
            }
        }

        a.clearingPrice = cp;

        // ── Compute balanced seed amount ──────────────────────────────────
        // Filled YES = bidders with pricePercent >= cp  → cumYesAt[cp]
        // Filled NO  = bidders with pricePercent <= cp  → cumNoAt[cp]
        // Seed each side equally at min(filledYes, filledNo)
        uint256 filledYes = cumYesAt[cp];
        uint256 filledNo  = cumNoAt[cp];
        uint256 perSide   = filledYes < filledNo ? filledYes : filledNo;

        // The total seed is split into reserveYes and reserveNo per clearing price
        uint256 totalSeed = perSide * 2;
        uint256 reserveNo  = totalSeed > 0 ? (totalSeed * cp)          / 100 : 0;
        uint256 reserveYes = totalSeed > 0 ? totalSeed - reserveNo          : 0;

        a.totalSeed   = totalSeed;
        a.totalFilled = filledYes + filledNo; // informational (includes excess refunded)

        address market;
        if (reserveYes > 0 && reserveNo > 0) {
            // Approve factory to pull the seed from this contract
            usdc.approve(address(factory), totalSeed);
            market = factory.createMarketWithCustomSeed(
                a.question,
                a.marketDuration,
                reserveYes,
                reserveNo
            );
        }
        a.market = market;

        emit Finalized(id, cp, market, reserveYes, reserveNo);
    }

    // ─────────────────────────────────────────────
    // Phase 4 — Claim LP shares / Refund
    // ─────────────────────────────────────────────

    /// @notice Claim LP shares in the deployed market (filled bids)
    ///         or receive a USDC refund (unfilled / unrevealed / excess bids).
    ///
    ///         Filled bidder's LP share:
    ///           filledAmount = escrowed * (perSide / filledSideDemand)   [pro-rata if capped]
    ///           sharesYes = market.totalSharesYes * filledAmount / totalSeed
    ///           sharesNo  = market.totalSharesNo  * filledAmount / totalSeed
    function claimLPShares(uint256 id) external nonReentrant {
        Auction storage a   = auctions[id];
        Bid     storage bid = bids[id][msg.sender];

        require(bid.usdcEscrowed > 0, "No bid");
        require(!bid.claimed,         "Already claimed");
        bid.claimed = true;

        // ── Cancelled → full refund ───────────────────────────────────────
        if (a.status == AuctionStatus.Cancelled) {
            usdc.safeTransfer(msg.sender, bid.usdcEscrowed);
            emit Refunded(id, msg.sender, bid.usdcEscrowed);
            return;
        }

        require(a.status == AuctionStatus.Finalized, "Not finalized");

        // ── Unrevealed → full refund ──────────────────────────────────────
        if (!bid.revealed) {
            usdc.safeTransfer(msg.sender, bid.usdcEscrowed);
            emit Refunded(id, msg.sender, bid.usdcEscrowed);
            return;
        }

        uint8 cp = a.clearingPrice;

        // ── Check if bid is filled ────────────────────────────────────────
        // YES bid filled if its price ≥ clearingPrice
        // NO  bid filled if its price ≤ clearingPrice
        bool filled = bid.buyYes
            ? bid.revealedPrice >= cp
            : bid.revealedPrice <= cp;

        if (!filled) {
            usdc.safeTransfer(msg.sender, bid.usdcEscrowed);
            emit Refunded(id, msg.sender, bid.usdcEscrowed);
            return;
        }

        // ── Compute total demand on this bidder's side ────────────────────
        uint256 sideDemand = 0;
        if (bid.buyYes) {
            for (uint8 p = cp; p <= MAX_PRICE; p++) {
                sideDemand += yesDemand[id][p];
            }
        } else {
            for (uint8 p = MIN_PRICE; p <= cp; p++) {
                sideDemand += noDemand[id][p];
            }
        }

        // perSide = min(filledYes, filledNo) already captured as totalSeed/2
        uint256 perSide = a.totalSeed / 2;

        // ── Pro-rata filled amount (if this side was over-subscribed) ─────
        uint256 filledAmount;
        uint256 refundAmount;
        if (sideDemand > perSide && sideDemand > 0) {
            filledAmount = (bid.usdcEscrowed * perSide) / sideDemand;
            refundAmount = bid.usdcEscrowed - filledAmount;
        } else {
            filledAmount = bid.usdcEscrowed;
            refundAmount = 0;
        }

        // ── Refund excess ─────────────────────────────────────────────────
        if (refundAmount > 0) {
            usdc.safeTransfer(msg.sender, refundAmount);
            emit Refunded(id, msg.sender, refundAmount);
        }

        // ── Grant LP shares proportional to filledAmount / totalSeed ─────
        if (filledAmount > 0 && a.market != address(0) && a.totalSeed > 0) {
            VeritasMarket mkt = VeritasMarket(a.market);

            // LP shares held by this auction contract = seedYes/seedNo at seeding time
            // which equal the market's reserveYes/reserveNo at T=0
            // Bidder's fraction = filledAmount / totalSeed
            uint256 bidderSharesYes = (mkt.sharesYes(address(this)) * filledAmount) / a.totalSeed;
            uint256 bidderSharesNo  = (mkt.sharesNo(address(this))  * filledAmount) / a.totalSeed;

            if (bidderSharesYes > 0 || bidderSharesNo > 0) {
                mkt.transferLPSharesFromAuction(msg.sender, bidderSharesYes, bidderSharesNo);
                emit LPSharesClaimed(id, msg.sender, bidderSharesYes, bidderSharesNo);
            }
        }
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Get the full demand curve for both sides (useful for UI during reveal).
    ///         Returns cumulative YES demand (bids with price ≥ p) and
    ///         cumulative NO demand (bids with price ≤ p) at each price point 1–99.
    function getDemandCurve(uint256 id)
        external view
        returns (uint256[100] memory cumYesAt, uint256[100] memory cumNoAt)
    {
        uint256 runningYes = 0;
        for (uint8 p = MAX_PRICE; p >= MIN_PRICE; p--) {
            runningYes  += yesDemand[id][p];
            cumYesAt[p]  = runningYes;
            if (p == MIN_PRICE) break;
        }
        uint256 runningNo = 0;
        for (uint8 p = MIN_PRICE; p <= MAX_PRICE; p++) {
            runningNo   += noDemand[id][p];
            cumNoAt[p]   = runningNo;
        }
    }

    /// @notice Summary view for a single auction.
    function getAuction(uint256 id)
        external view
        returns (
            string        memory question,
            uint256              commitDeadline,
            uint256              revealDeadline,
            AuctionStatus        status,
            uint8                clearingPrice,
            address              market,
            uint256              totalSeed
        )
    {
        Auction storage a = auctions[id];
        return (
            a.question,
            a.commitDeadline,
            a.revealDeadline,
            a.status,
            a.clearingPrice,
            a.market,
            a.totalSeed
        );
    }

    /// @notice Helper to compute the commit hash off-chain (call statically).
    function computeCommitHash(
        uint8   pricePercent,
        bool    buyYes,
        bytes32 salt,
        uint256 usdcAmount
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(pricePercent, buyYes, salt, usdcAmount));
    }
}
