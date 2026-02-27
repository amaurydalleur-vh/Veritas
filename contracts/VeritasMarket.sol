// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITreasuryRouter.sol";

/// @title VeritasMarket
/// @notice Binary prediction market with VALS protection and RWA Gravity redistribution.
/// @dev Deployed by VeritasFactory. Uses USDC (6 decimals) as collateral.
contract VeritasMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    uint256 public constant PRECISION = 1e18;

    // Fee basis points (out of 10_000)
    uint256 public constant FEE_PROTOCOL_BPS = 50;   // 0.5%
    uint256 public constant FEE_LP_BPS       = 70;   // 0.7%
    uint256 public constant FEE_GRAVITY_BPS  = 30;   // 0.3%
    uint256 public constant FEE_TOTAL_BPS    = 150;  // 1.5%

    // VALS: circuit breaker window (seconds)
    uint256 public constant CIRCUIT_BREAKER_WINDOW = 5;

    // VALS: max allowed trade as % of pool (basis points)
    uint256 public constant MAX_TRADE_BPS = 1000; // 10% of pool per trade

    // RWA Gravity: simulated T-bill APY (basis points per year)
    // 400 bps = 4% APY, applied per block for redistribution
    uint256 public constant GRAVITY_APY_BPS = 400;

    // Settlement window: market must resolve within this time
    uint256 public constant MAX_DURATION = 365 days;

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public immutable oracle;
    address public immutable factory;
    address public immutable protocol; // receives protocol fees
    address public treasuryRouter;

    string  public question;
    uint256 public createdAt;
    uint256 public expiresAt;

    // AMM reserves (USDC, 6 decimals)
    uint256 public reserveYes;
    uint256 public reserveNo;

    // Total LP shares per side
    uint256 public totalSharesYes;
    uint256 public totalSharesNo;

    // LP positions: user => shares per side
    mapping(address => uint256) public sharesYes;
    mapping(address => uint256) public sharesNo;

    // Gravity pool: accumulated yield for redistribution to minority LPs
    uint256 public gravityPool;

    // Protocol fee accumulator
    uint256 public protocolFees;

    // VALS: last large-trade timestamp (circuit breaker)
    uint256 public lastLargeTrade;

    // Settlement
    bool   public settled;
    bool   public outcomeYes; // true = YES wins

    // Gravity: last accrual timestamp
    uint256 public gravityLastAccrual;

    // Track unique participants for Ignition graduation
    uint256 public participantCount;
    mapping(address => bool) public hasParticipated;

    // Dutch Auction: authorized to distribute LP shares to bidders post-seeding
    address public dutchAuction;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event LiquidityAdded(address indexed user, uint256 amountYes, uint256 amountNo);
    event LiquidityRemoved(address indexed user, uint256 amountYes, uint256 amountNo);
    event Trade(address indexed user, bool buyYes, uint256 amountIn, uint256 amountOut, uint256 fee);
    event Settled(bool outcomeYes);
    event Redeemed(address indexed user, uint256 amount);
    event GravityAccrued(uint256 amount);
    event ProtocolFeesWithdrawn(uint256 amount);
    event TreasuryRouterSet(address indexed router);
    event IdleSwept(uint256 amount);

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    modifier notSettled() {
        require(!settled, "Market settled");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Not factory");
        _;
    }

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(
        address _usdc,
        address _oracle,
        address _factory,
        address _protocol,
        string memory _question,
        uint256 _duration // seconds until expiry
    ) {
        require(_duration > 0 && _duration <= MAX_DURATION, "Invalid duration");
        usdc     = IERC20(_usdc);
        oracle   = _oracle;
        factory  = _factory;
        protocol = _protocol;
        question = _question;
        createdAt = block.timestamp;
        expiresAt = block.timestamp + _duration;
        gravityLastAccrual = block.timestamp;
    }

    // ─────────────────────────────────────────────
    // Liquidity
    // ─────────────────────────────────────────────

    /// @notice Seed initial liquidity. Called once by factory after deployment.
    /// @param amountYes USDC deposited on YES side
    /// @param amountNo  USDC deposited on NO side
    function seedLiquidity(address from, uint256 amountYes, uint256 amountNo)
        external onlyFactory nonReentrant
    {
        require(reserveYes == 0 && reserveNo == 0, "Already seeded");
        require(amountYes > 0 && amountNo > 0, "Zero amounts");

        usdc.safeTransferFrom(from, address(this), amountYes + amountNo);

        reserveYes = amountYes;
        reserveNo  = amountNo;

        // Bootstrap LP shares 1:1 with USDC
        sharesYes[from]  = amountYes;
        sharesNo[from]   = amountNo;
        totalSharesYes   = amountYes;
        totalSharesNo    = amountNo;

        _trackParticipant(from);
        emit LiquidityAdded(from, amountYes, amountNo);
    }

    /// @notice Add liquidity proportionally to both sides
    /// @param amount Total USDC to deposit (split evenly YES/NO)
    function addLiquidity(uint256 amount) external notSettled nonReentrant {
        require(amount > 0, "Zero amount");
        uint256 half = amount / 2;
        require(half > 0, "Amount too small");
        _addLiquidityAsymmetric(half, half, 0, 0);
    }

    /// @notice Add liquidity asymmetrically to YES/NO sides.
    /// @param amountYes   USDC added to YES reserve
    /// @param amountNo    USDC added to NO reserve
    /// @param minSharesYes Minimum YES LP shares expected (slippage protection)
    /// @param minSharesNo  Minimum NO LP shares expected (slippage protection)
    function addLiquidityAsymmetric(
        uint256 amountYes,
        uint256 amountNo,
        uint256 minSharesYes,
        uint256 minSharesNo
    ) external notSettled nonReentrant {
        require(amountYes > 0 || amountNo > 0, "Zero amounts");
        _addLiquidityAsymmetric(amountYes, amountNo, minSharesYes, minSharesNo);
    }

    /// @notice Remove liquidity proportionally
    /// @param sharesFractionBps Fraction of your shares to remove (bps, max 10000)
    function removeLiquidity(uint256 sharesFractionBps) external notSettled nonReentrant {
        require(sharesFractionBps > 0 && sharesFractionBps <= 10_000, "Invalid fraction");
        uint256 sYes = (sharesYes[msg.sender] * sharesFractionBps) / 10_000;
        uint256 sNo  = (sharesNo[msg.sender]  * sharesFractionBps) / 10_000;
        _removeLiquidityAsymmetric(sYes, sNo, 0, 0);
    }

    /// @notice Remove liquidity asymmetrically by burning side-specific LP shares.
    /// @param sharesYesToBurn YES LP shares to burn
    /// @param sharesNoToBurn  NO LP shares to burn
    /// @param minOutYes       Minimum YES-side USDC out (slippage protection)
    /// @param minOutNo        Minimum NO-side USDC out (slippage protection)
    function removeLiquidityAsymmetric(
        uint256 sharesYesToBurn,
        uint256 sharesNoToBurn,
        uint256 minOutYes,
        uint256 minOutNo
    ) external notSettled nonReentrant {
        require(sharesYesToBurn > 0 || sharesNoToBurn > 0, "No shares");
        _removeLiquidityAsymmetric(sharesYesToBurn, sharesNoToBurn, minOutYes, minOutNo);
    }

    // ─────────────────────────────────────────────
    // Trading (VALS-protected AMM)
    // ─────────────────────────────────────────────

    /// @notice Buy YES or NO shares using the AMM
    /// @param buyYes       true = buy YES, false = buy NO
    /// @param amountIn     USDC to spend (before fees)
    /// @param minAmountOut Slippage protection — revert if output below this
    function trade(bool buyYes, uint256 amountIn, uint256 minAmountOut)
        external notSettled nonReentrant
    {
        require(amountIn > 0, "Zero amount");
        require(block.timestamp < expiresAt, "Market expired");

        _accrueGravity();
        _valsCheck(amountIn);

        // Collect fees
        uint256 feeTotal    = (amountIn * FEE_TOTAL_BPS)    / 10_000;
        uint256 feeProtocol = (amountIn * FEE_PROTOCOL_BPS) / 10_000;
        uint256 feeGravity  = (amountIn * FEE_GRAVITY_BPS)  / 10_000;
        uint256 feeLp       = feeTotal - feeProtocol - feeGravity;
        uint256 amountInNet = amountIn - feeTotal;

        // Constant product AMM: (reserveIn + Δin) * reserveOut_new = k
        (uint256 reserveIn, uint256 reserveOut) = buyYes
            ? (reserveNo, reserveYes)
            : (reserveYes, reserveNo);

        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + amountInNet;
        uint256 newReserveOut = k / newReserveIn;
        uint256 amountOut = reserveOut - newReserveOut;

        require(amountOut >= minAmountOut, "VALS: slippage too high");
        require(amountOut < reserveOut, "Insufficient liquidity");

        // Apply reserves update
        if (buyYes) {
            reserveNo  = newReserveIn  + feeLp; // LP fees stay in pool
            reserveYes = newReserveOut;
        } else {
            reserveYes = newReserveIn  + feeLp;
            reserveNo  = newReserveOut;
        }

        protocolFees += feeProtocol;
        gravityPool  += feeGravity;

        // Transfer USDC in, outcome tokens out (represented as USDC claim)
        usdc.safeTransferFrom(msg.sender, address(this), amountIn);

        // Record trade as a directional position (simplified: store as pending claim)
        _recordPosition(msg.sender, buyYes, amountOut);

        _trackParticipant(msg.sender);
        emit Trade(msg.sender, buyYes, amountIn, amountOut, feeTotal);
    }

    // ─────────────────────────────────────────────
    // Positions (simplified claim model)
    // ─────────────────────────────────────────────

    // User positions: claimable USDC if their side wins
    mapping(address => uint256) public positionYes;
    mapping(address => uint256) public positionNo;

    function _recordPosition(address user, bool isYes, uint256 amount) internal {
        if (isYes) {
            positionYes[user] += amount;
        } else {
            positionNo[user] += amount;
        }
    }

    function _addLiquidityAsymmetric(
        uint256 amountYes,
        uint256 amountNo,
        uint256 minSharesYes,
        uint256 minSharesNo
    ) internal {
        _accrueGravity();

        usdc.safeTransferFrom(msg.sender, address(this), amountYes + amountNo);

        uint256 newSharesYes = amountYes > 0
            ? (reserveYes == 0 || totalSharesYes == 0 ? amountYes : (amountYes * totalSharesYes) / reserveYes)
            : 0;
        uint256 newSharesNo = amountNo > 0
            ? (reserveNo == 0 || totalSharesNo == 0 ? amountNo : (amountNo * totalSharesNo) / reserveNo)
            : 0;

        require(newSharesYes >= minSharesYes, "YES slippage");
        require(newSharesNo  >= minSharesNo,  "NO slippage");

        // Avoid dust deposits that mint 0 shares on an active side.
        if (amountYes > 0) require(newSharesYes > 0, "YES amount too small");
        if (amountNo > 0)  require(newSharesNo > 0,  "NO amount too small");

        sharesYes[msg.sender] += newSharesYes;
        sharesNo[msg.sender]  += newSharesNo;
        totalSharesYes        += newSharesYes;
        totalSharesNo         += newSharesNo;
        reserveYes            += amountYes;
        reserveNo             += amountNo;

        _trackParticipant(msg.sender);
        emit LiquidityAdded(msg.sender, amountYes, amountNo);
    }

    function _removeLiquidityAsymmetric(
        uint256 sharesYesToBurn,
        uint256 sharesNoToBurn,
        uint256 minOutYes,
        uint256 minOutNo
    ) internal {
        _accrueGravity();

        require(sharesYes[msg.sender] >= sharesYesToBurn, "Insufficient YES shares");
        require(sharesNo[msg.sender]  >= sharesNoToBurn,  "Insufficient NO shares");

        uint256 outYes = sharesYesToBurn > 0
            ? (sharesYesToBurn * reserveYes) / totalSharesYes
            : 0;
        uint256 outNo = sharesNoToBurn > 0
            ? (sharesNoToBurn * reserveNo) / totalSharesNo
            : 0;

        require(outYes >= minOutYes, "YES out too low");
        require(outNo  >= minOutNo,  "NO out too low");

        sharesYes[msg.sender] -= sharesYesToBurn;
        sharesNo[msg.sender]  -= sharesNoToBurn;
        totalSharesYes        -= sharesYesToBurn;
        totalSharesNo         -= sharesNoToBurn;
        reserveYes            -= outYes;
        reserveNo             -= outNo;

        _ensureLiquidity(outYes + outNo);
        usdc.safeTransfer(msg.sender, outYes + outNo);
        emit LiquidityRemoved(msg.sender, outYes, outNo);
    }

    /// @notice Redeem winnings after settlement
    function redeem() external nonReentrant {
        require(settled, "Not settled");

        uint256 payout = 0;

        if (outcomeYes) {
            // YES wins: pay YES position holders at 1:1 (backed by NO reserves that flowed in)
            payout += positionYes[msg.sender];
            positionYes[msg.sender] = 0;
        } else {
            payout += positionNo[msg.sender];
            positionNo[msg.sender] = 0;
        }

        // LP redemption — winning-side LPs get their reserves + gravity bonus
        uint256 lpPayout = _redeemLpShares(msg.sender);
        payout += lpPayout;

        require(payout > 0, "Nothing to redeem");
        _ensureLiquidity(payout);
        usdc.safeTransfer(msg.sender, payout);
        emit Redeemed(msg.sender, payout);
    }

    function _redeemLpShares(address user) internal returns (uint256 payout) {
        if (outcomeYes && sharesYes[user] > 0) {
            uint256 s = sharesYes[user];
            payout = (s * reserveYes) / totalSharesYes;
            // Minority (NO side) LPs also receive gravity pool share
            sharesYes[user] = 0;
            totalSharesYes -= s;
        }
        if (!outcomeYes && sharesNo[user] > 0) {
            uint256 s = sharesNo[user];
            payout += (s * reserveNo) / totalSharesNo;
            sharesNo[user] = 0;
            totalSharesNo -= s;
        }
        // Gravity bonus for minority LPs
        if (outcomeYes && sharesNo[user] > 0) {
            // User was on losing (minority) side — receives gravity pool share
            uint256 s = sharesNo[user];
            uint256 gravityShare = (s * gravityPool) / totalSharesNo;
            gravityPool -= gravityShare;
            payout += gravityShare;
            sharesNo[user] = 0;
            totalSharesNo -= s;
        } else if (!outcomeYes && sharesYes[user] > 0) {
            uint256 s = sharesYes[user];
            uint256 gravityShare = (s * gravityPool) / totalSharesYes;
            gravityPool -= gravityShare;
            payout += gravityShare;
            sharesYes[user] = 0;
            totalSharesYes -= s;
        }
    }

    // ─────────────────────────────────────────────
    // VALS Protection
    // ─────────────────────────────────────────────

    /// @notice VALS check: circuit breaker + size limit
    function _valsCheck(uint256 amountIn) internal {
        uint256 poolSize = reserveYes + reserveNo;

        // Circuit breaker: if a large trade happened recently, block trading briefly
        bool isLargeTrade = amountIn > (poolSize * MAX_TRADE_BPS) / 10_000;
        if (isLargeTrade) {
            require(
                block.timestamp >= lastLargeTrade + CIRCUIT_BREAKER_WINDOW,
                "VALS: circuit breaker active"
            );
            lastLargeTrade = block.timestamp;
        }

        // Hard cap: single trade cannot exceed 20% of pool
        require(amountIn <= (poolSize * 2000) / 10_000, "VALS: trade too large");
    }

    // ─────────────────────────────────────────────
    // RWA Gravity (T-bill yield redistribution)
    // ─────────────────────────────────────────────

    /// @notice Accrue simulated T-bill yield into the gravity pool
    /// @dev Called before every state change. Redistributes from majority to minority.
    function _accrueGravity() internal {
        uint256 elapsed = block.timestamp - gravityLastAccrual;
        if (elapsed == 0 || reserveYes + reserveNo == 0) return;

        uint256 totalReserve = reserveYes + reserveNo;

        // Simulated T-bill yield: 4% APY on total reserves
        // yield = totalReserve * APY * elapsed / (365 days * 10_000)
        uint256 yield = (totalReserve * GRAVITY_APY_BPS * elapsed) / (365 days * 10_000);

        if (yield > 0) {
            // Yield comes from majority side reserves (larger side pays into gravity)
            if (reserveYes >= reserveNo) {
                uint256 take = yield < reserveYes / 100 ? yield : reserveYes / 100;
                reserveYes  -= take;
                gravityPool += take;
            } else {
                uint256 take = yield < reserveNo / 100 ? yield : reserveNo / 100;
                reserveNo   -= take;
                gravityPool += take;
            }
            gravityLastAccrual = block.timestamp;
            emit GravityAccrued(yield);
        }
    }

    // ─────────────────────────────────────────────
    // Settlement
    // ─────────────────────────────────────────────

    /// @notice Called by oracle to settle the market
    function settle(bool _outcomeYes) external onlyOracle notSettled {
        _accrueGravity();
        settled    = true;
        outcomeYes = _outcomeYes;
        emit Settled(_outcomeYes);
    }

    // ─────────────────────────────────────────────
    // Protocol fees
    // ─────────────────────────────────────────────

    function withdrawProtocolFees() external {
        require(msg.sender == protocol, "Not protocol");
        uint256 amount = protocolFees;
        protocolFees = 0;
        _ensureLiquidity(amount);
        usdc.safeTransfer(protocol, amount);
        emit ProtocolFeesWithdrawn(amount);
    }

    function _ensureLiquidity(uint256 needed) internal {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal >= needed || treasuryRouter == address(0)) return;
        ITreasuryRouter(treasuryRouter).requestLiquidity(needed - bal, address(this));
    }

    // ─────────────────────────────────────────────
    // Dutch Auction LP share distribution
    // ─────────────────────────────────────────────

    /// @notice Called once by factory: transfers LP shares from factory to auction contract.
    ///         After createMarketWithCustomSeed seeds via factory, shares temporarily sit
    ///         in factory's account. This moves them to the auction before distribution.
    function transferInitialLPShares(address to, uint256 amtYes, uint256 amtNo)
        external onlyFactory
    {
        require(sharesYes[factory] >= amtYes, "Insufficient YES shares");
        require(sharesNo[factory]  >= amtNo,  "Insufficient NO shares");
        sharesYes[factory] -= amtYes;
        sharesNo[factory]  -= amtNo;
        sharesYes[to] += amtYes;
        sharesNo[to]  += amtNo;
    }

    /// @notice Called once by factory after seeding to register the Dutch Auction contract.
    function setDutchAuction(address _auction) external onlyFactory {
        require(dutchAuction == address(0), "Already set");
        require(_auction != address(0), "Zero address");
        dutchAuction = _auction;
    }

    function setTreasuryRouter(address router) external onlyFactory {
        treasuryRouter = router;
        emit TreasuryRouterSet(router);
    }

    /// @notice Move idle USDC from market to treasury router.
    function sweepIdleToRouter(uint256 amount) external onlyFactory {
        require(treasuryRouter != address(0), "Router not set");
        require(amount > 0, "Zero amount");
        usdc.safeIncreaseAllowance(treasuryRouter, amount);
        ITreasuryRouter(treasuryRouter).depositFromSource(amount);
        emit IdleSwept(amount);
    }

    /// @notice Transfer LP shares from the auction contract to a bidder.
    ///         Called per bidder during claimLPShares on the auction.
    function transferLPSharesFromAuction(
        address to,
        uint256 amtSharesYes,
        uint256 amtSharesNo
    ) external {
        require(msg.sender == dutchAuction, "Not dutch auction");
        require(sharesYes[dutchAuction] >= amtSharesYes, "Insufficient YES shares");
        require(sharesNo[dutchAuction]  >= amtSharesNo,  "Insufficient NO shares");
        sharesYes[dutchAuction] -= amtSharesYes;
        sharesNo[dutchAuction]  -= amtSharesNo;
        sharesYes[to] += amtSharesYes;
        sharesNo[to]  += amtSharesNo;
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Current implied probability of YES (0–1e18 = 0–100%)
    function impliedProbabilityYes() external view returns (uint256) {
        uint256 total = reserveYes + reserveNo;
        if (total == 0) return 5e17; // 50%
        // In a CFMM, probability ≈ reserveNo / (reserveYes + reserveNo)
        return (reserveNo * PRECISION) / total;
    }

    /// @notice Spot price: USDC cost to buy 1 YES share
    function spotPriceYes() external view returns (uint256) {
        if (reserveYes == 0) return 0;
        return (reserveNo * PRECISION) / reserveYes;
    }

    /// @notice Total value locked in the market (USDC)
    function tvl() external view returns (uint256) {
        return reserveYes + reserveNo + gravityPool + protocolFees;
    }

    /// @notice Get market info in one call
    function marketInfo() external view returns (
        string memory _question,
        uint256 _reserveYes,
        uint256 _reserveNo,
        uint256 _gravityPool,
        uint256 _expiresAt,
        bool _settled,
        bool _outcomeYes,
        uint256 _participantCount
    ) {
        return (
            question,
            reserveYes,
            reserveNo,
            gravityPool,
            expiresAt,
            settled,
            outcomeYes,
            participantCount
        );
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    function _trackParticipant(address user) internal {
        if (!hasParticipated[user]) {
            hasParticipated[user] = true;
            participantCount++;
        }
    }
}
