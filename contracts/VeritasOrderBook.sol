// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VeritasMarket.sol";

interface IVeritasFactoryRegistry {
    function isMarket(address market) external view returns (bool);
}

/// @title  VeritasOrderBook
/// @notice On-chain Central Limit Order Book (CLOB) for Veritas binary prediction markets.
///
/// @dev    **Price convention**
///         `price` is an integer in [1, 99] representing the implied YES probability
///         in whole-percent "cents": a YES order at price P costs P USDC-cents per
///         YES share, a NO order at price Q costs Q USDC-cents per NO share.
///
///         **Matching rule**
///         A YES order at P matches ONLY a NO order at (100 − P). Together they
///         deposit exactly 100 cents of USDC per share pair, which is the settlement
///         value of one YES + one NO share.  There is no partial-price crossing.
///
///         **Accounting**
///         All USDC is escrowed here until the market is settled.  After settlement,
///         each user calls `claimPosition` to receive the escrowed USDC for the
///         winning side (positions on the losing side are worthless, per prediction
///         market mechanics).
///
///         **Protocol fee**
///         FEE_BPS (10 bps = 0.1 %) is deducted from every matched trade's combined
///         USDC amount and accumulates in `feeAccumulator` for the protocol address.
contract VeritasOrderBook is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    /// @notice Protocol fee on every match: 10 bps = 0.1 %
    uint256 public constant FEE_BPS = 10;

    // ─────────────────────────────────────────────
    // Immutables
    // ─────────────────────────────────────────────

    IERC20  public immutable usdc;
    address public immutable factory;
    address public immutable protocol;

    // ─────────────────────────────────────────────
    // Order storage
    // ─────────────────────────────────────────────

    struct Order {
        address maker;
        address market;   // VeritasMarket address
        bool    buyYes;   // true = buy YES shares, false = buy NO shares
        uint8   price;    // 1–99 cents per share (implied probability %)
        uint128 size;     // USDC escrowed (6 decimals)
        uint128 filled;   // USDC already matched (combined YES+NO contribution)
        bool    cancelled;
    }

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    // ─────────────────────────────────────────────
    // FIFO queue per (market × side × price)
    //   key = keccak256(abi.encodePacked(market, buyYes, price))
    // ─────────────────────────────────────────────

    mapping(bytes32 => uint64) public levelHead; // first live slot (inclusive)
    mapping(bytes32 => uint64) public levelTail; // next free slot (exclusive)
    mapping(bytes32 => mapping(uint64 => uint256)) public levelSlot; // slot → orderId

    // Bitmask of which price levels have resting orders (bit i = price i exists)
    mapping(address => uint128) public yesBidMask;
    mapping(address => uint128) public noBidMask;

    // ─────────────────────────────────────────────
    // Virtual positions (credited on fill, claimed after settlement)
    //   positionYes[user][market] = USDC claimable if YES wins
    //   positionNo [user][market] = USDC claimable if NO  wins
    // ─────────────────────────────────────────────

    mapping(address => mapping(address => uint256)) public positionYes;
    mapping(address => mapping(address => uint256)) public positionNo;

    /// @notice Accumulated protocol fees (claimable by `protocol`)
    uint256 public feeAccumulator;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        address indexed market,
        bool    buyYes,
        uint8   price,
        uint128 size
    );

    /// @param yesOrderId  Order on the YES side
    /// @param noOrderId   Order on the NO  side
    /// @param usdcYesSide USDC contributed by the YES maker in this fill
    /// @param usdcNoSide  USDC contributed by the NO  maker in this fill
    /// @param clearPrice  YES price (NO price = 100 − clearPrice)
    event OrderFilled(
        uint256 indexed yesOrderId,
        uint256 indexed noOrderId,
        uint128 usdcYesSide,
        uint128 usdcNoSide,
        uint8   clearPrice
    );

    event OrderCancelled(uint256 indexed orderId, uint128 refund);

    event PositionClaimed(address indexed user, address indexed market, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(address _usdc, address _factory, address _protocol) {
        require(_usdc     != address(0), "Zero usdc");
        require(_factory  != address(0), "Zero factory");
        require(_protocol != address(0), "Zero protocol");
        usdc     = IERC20(_usdc);
        factory  = _factory;
        protocol = _protocol;
    }

    // ─────────────────────────────────────────────
    // Place Order
    // ─────────────────────────────────────────────

    /// @notice Place a limit order. USDC is escrowed immediately and matching
    ///         is attempted against existing resting orders at the complementary
    ///         price.  Any unmatched remainder is added to the FIFO queue.
    ///
    /// @param market VeritasMarket address
    /// @param buyYes true = buy YES shares, false = buy NO shares
    /// @param price  1–99: YES probability in whole-percent cents
    /// @param size   USDC to spend (6 decimals, e.g. 1_000_000 = 1 USDC)
    /// @return orderId The new order ID
    function placeOrder(
        address market,
        bool    buyYes,
        uint8   price,
        uint128 size
    ) external nonReentrant returns (uint256 orderId) {
        require(price >= 1 && price <= 99, "Price out of range");
        require(size  >  0,                "Zero size");
        require(market != address(0),      "Zero market");
        require(IVeritasFactoryRegistry(factory).isMarket(market), "Unknown market");
        require(!VeritasMarket(market).settled(), "Market settled");

        // Escrow USDC
        usdc.safeTransferFrom(msg.sender, address(this), size);

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker:     msg.sender,
            market:    market,
            buyYes:    buyYes,
            price:     price,
            size:      size,
            filled:    0,
            cancelled: false
        });

        emit OrderPlaced(orderId, msg.sender, market, buyYes, price, size);

        // Immediate match against resting counterparty orders
        _match(orderId);

        // Enqueue remainder if not fully filled
        Order storage o = orders[orderId];
        if (!o.cancelled && o.filled < o.size) {
            _enqueue(market, buyYes, price, orderId);
        }
    }

    // ─────────────────────────────────────────────
    // Cancel Order
    // ─────────────────────────────────────────────

    /// @notice Cancel an open order and reclaim any unmatched escrowed USDC.
    ///         Works both before and after market settlement (for unfilled portions).
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        require(o.maker    == msg.sender, "Not maker");
        require(!o.cancelled,             "Already cancelled");
        require(o.filled   <  o.size,     "Fully filled");

        o.cancelled = true;

        uint128 refund = o.size - o.filled;
        usdc.safeTransfer(msg.sender, refund);

        emit OrderCancelled(orderId, refund);
    }

    // ─────────────────────────────────────────────
    // Claim settled position
    // ─────────────────────────────────────────────

    /// @notice After the market settles, claim USDC for filled orders on the
    ///         winning side.  Losing-side positions receive nothing.
    function claimPosition(address market) external nonReentrant {
        VeritasMarket vm = VeritasMarket(market);
        require(vm.settled(), "Not settled");

        uint256 payout;
        if (vm.outcomeYes()) {
            payout = positionYes[msg.sender][market];
            positionYes[msg.sender][market] = 0;
        } else {
            payout = positionNo[msg.sender][market];
            positionNo[msg.sender][market] = 0;
        }

        require(payout > 0, "Nothing to claim");
        usdc.safeTransfer(msg.sender, payout);

        emit PositionClaimed(msg.sender, market, payout);
    }

    // ─────────────────────────────────────────────
    // Protocol fee withdrawal
    // ─────────────────────────────────────────────

    function withdrawFees() external {
        require(msg.sender == protocol, "Not protocol");
        uint256 amount = feeAccumulator;
        feeAccumulator = 0;
        usdc.safeTransfer(protocol, amount);
    }

    // ─────────────────────────────────────────────
    // Internal: Matching engine
    // ─────────────────────────────────────────────

    /// @dev Match `incomingId` against resting orders at the complementary price.
    ///
    ///      For each matched pair (YES @ P, NO @ Q=100−P):
    ///        N shares are traded where N = min(iRemain*100/P, rRemain*100/Q)
    ///        iFill = N * P / 100   (USDC from YES maker)
    ///        rFill = N * Q / 100   (USDC from NO  maker)
    ///        iFill + rFill ≈ N     (total escrowed per N shares, ignoring rounding)
    ///
    ///      Fee = (iFill + rFill) * FEE_BPS / 10_000
    ///      netPot = iFill + rFill − fee  (held in contract for the winner)
    ///
    ///      positionYes[yesMaker][market] += netPot
    ///      positionNo [noMaker ][market] += netPot
    ///
    ///      At settlement exactly ONE side claims netPot; total payouts = total held. ✓
    function _match(uint256 incomingId) internal {
        Order storage incoming = orders[incomingId];

        uint8   cprice = uint8(100) - incoming.price; // complementary price
        bool    cside  = !incoming.buyYes;
        bytes32 ckey   = _key(incoming.market, cside, cprice);

        uint64 head = levelHead[ckey];
        uint64 tail = levelTail[ckey];

        while (head < tail && incoming.filled < incoming.size) {
            uint256 restingId = levelSlot[ckey][head];
            Order storage resting = orders[restingId];

            // Skip stale (cancelled or fully filled)
            if (resting.cancelled || resting.filled >= resting.size) {
                head++;
                continue;
            }

            uint128 iRemain = incoming.size - incoming.filled;
            uint128 rRemain = resting.size  - resting.filled;

            // Compute share count N (micro-share units in same decimal base as USDC)
            // N * P / 100 = iFill  →  N = iFill * 100 / P
            // Constraints:
            //   N * P   ≤ iRemain * 100
            //   N * Q   ≤ rRemain * 100
            uint256 nFromI = (uint256(iRemain) * 100) / incoming.price;
            uint256 nFromR = (uint256(rRemain) * 100) / cprice;
            uint256 N      = nFromI < nFromR ? nFromI : nFromR;

            if (N == 0) { head++; continue; }

            uint128 iFill = uint128((N * incoming.price) / 100);
            uint128 rFill = uint128((N * cprice)         / 100);

            // Guard against zero-fill rounding (dust)
            if (iFill == 0 || rFill == 0) { head++; continue; }

            // Protocol fee on combined notional
            uint256 combinedFill = uint256(iFill) + uint256(rFill);
            uint128 fee          = uint128((combinedFill * FEE_BPS) / 10_000);
            feeAccumulator      += fee;

            // Net USDC held in contract for this matched trade
            uint256 netPot = combinedFill - fee;

            // Credit virtual positions to both makers
            // At settlement, exactly one side is paid out; the other forfeits.
            if (incoming.buyYes) {
                // incoming = YES buyer, resting = NO buyer
                positionYes[incoming.maker][incoming.market] += netPot;
                positionNo [resting.maker ][resting.market ] += netPot;
                emit OrderFilled(incomingId, restingId, iFill, rFill, incoming.price);
            } else {
                // incoming = NO buyer, resting = YES buyer
                positionNo [incoming.maker][incoming.market] += netPot;
                positionYes[resting.maker ][resting.market ] += netPot;
                emit OrderFilled(restingId, incomingId, rFill, iFill, cprice);
            }

            // Update fill amounts
            incoming.filled += iFill;
            resting.filled  += rFill;

            // Advance queue head if resting is fully filled
            if (resting.filled >= resting.size) {
                head++;
            }
        }

        // Persist the advanced head pointer
        levelHead[ckey] = head;

        // Clear bitmask bit if the level is now empty
        if (head >= levelTail[ckey]) {
            if (cside) {
                noBidMask[incoming.market] &= ~(uint128(1) << cprice);
            } else {
                yesBidMask[incoming.market] &= ~(uint128(1) << cprice);
            }
        }
    }

    // ─────────────────────────────────────────────
    // Internal: Queue helpers
    // ─────────────────────────────────────────────

    function _enqueue(
        address market,
        bool    buyYes,
        uint8   price,
        uint256 orderId
    ) internal {
        bytes32 key  = _key(market, buyYes, price);
        uint64  tail = levelTail[key];
        levelSlot[key][tail] = orderId;
        levelTail[key]       = tail + 1;

        // Mark price level as occupied in the bitmask
        if (buyYes) {
            yesBidMask[market] |= (uint128(1) << price);
        } else {
            noBidMask[market]  |= (uint128(1) << price);
        }
    }

    function _key(
        address market,
        bool    buyYes,
        uint8   price
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(market, buyYes, price));
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Full order info for a given ID.
    function getOrder(uint256 orderId)
        external view
        returns (
            address maker,
            address market,
            bool    buyYes,
            uint8   price,
            uint128 size,
            uint128 filled,
            bool    cancelled
        )
    {
        Order storage o = orders[orderId];
        return (o.maker, o.market, o.buyYes, o.price, o.size, o.filled, o.cancelled);
    }

    /// @notice Resting USDC at a specific price level (excluding cancelled/filled).
    function levelDepth(address market, bool buyYes, uint8 price)
        external view
        returns (uint256 totalRestingUSDC)
    {
        bytes32 key  = _key(market, buyYes, price);
        uint64  head = levelHead[key];
        uint64  tail = levelTail[key];
        for (uint64 i = head; i < tail; i++) {
            Order storage o = orders[levelSlot[key][i]];
            if (!o.cancelled && o.filled < o.size) {
                totalRestingUSDC += o.size - o.filled;
            }
        }
    }

    /// @notice Aggregate order-book depth for a side across all 99 price levels.
    ///         Returns parallel arrays sorted by price ascending (1 → 99).
    ///         Off-chain / view only — not gas-efficient for on-chain calls.
    function getOrderBook(address market, bool buyYes)
        external view
        returns (
            uint8[]   memory prices,
            uint256[] memory restingUSDC
        )
    {
        uint128 mask  = buyYes ? yesBidMask[market] : noBidMask[market];
        uint8   count = 0;
        for (uint8 p = 1; p <= 99; p++) {
            if ((mask >> p) & 1 == 1) count++;
        }
        prices      = new uint8[](count);
        restingUSDC = new uint256[](count);
        uint8 idx   = 0;
        for (uint8 p = 1; p <= 99; p++) {
            if ((mask >> p) & 1 != 1) continue;
            prices[idx] = p;
            bytes32 key = _key(market, buyYes, p);
            uint64  h   = levelHead[key];
            uint64  t   = levelTail[key];
            uint256 tot;
            for (uint64 i = h; i < t; i++) {
                Order storage o = orders[levelSlot[key][i]];
                if (!o.cancelled && o.filled < o.size) {
                    tot += o.size - o.filled;
                }
            }
            restingUSDC[idx] = tot;
            idx++;
        }
    }

    /// @notice Best YES bid price currently in the book (highest price, most bullish).
    ///         Returns (0, false) if the YES side is empty.
    function bestYesBid(address market)
        external view
        returns (uint8 price, bool exists)
    {
        uint128 mask = yesBidMask[market];
        for (uint8 p = 99; p >= 1; p--) {
            if ((mask >> p) & 1 == 1) return (p, true);
            if (p == 1) break;
        }
        return (0, false);
    }

    /// @notice Best NO bid price currently in the book (highest NO price,
    ///         equivalent to lowest YES price on the other side).
    ///         Returns (0, false) if the NO side is empty.
    function bestNoBid(address market)
        external view
        returns (uint8 price, bool exists)
    {
        uint128 mask = noBidMask[market];
        for (uint8 p = 99; p >= 1; p--) {
            if ((mask >> p) & 1 == 1) return (p, true);
            if (p == 1) break;
        }
        return (0, false);
    }

    /// @notice Implied mid-price from the order book (simple average of best bids).
    ///         Returns 0 if either side is empty.
    ///         Note: in equilibrium YES best bid + NO best bid ≈ 100.
    function midPrice(address market)
        external view
        returns (uint8 yesMid, uint8 noMid)
    {
        uint128 yMask = yesBidMask[market];
        uint128 nMask = noBidMask[market];
        for (uint8 p = 99; p >= 1; p--) {
            if (yesMid == 0 && (yMask >> p) & 1 == 1) yesMid = p;
            if (noMid  == 0 && (nMask >> p) & 1 == 1) noMid  = p;
            if (yesMid > 0 && noMid > 0) break;
            if (p == 1) break;
        }
    }
}
