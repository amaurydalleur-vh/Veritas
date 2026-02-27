// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./VeritasMarket.sol";

/// @title VeritasFactory
/// @notice Deploys new VeritasMarket instances and maintains a registry.
contract VeritasFactory is Ownable {
    using SafeERC20 for IERC20;

    IERC20  public immutable usdc;
    address public immutable oracle;

    // Protocol fee recipient
    address public protocol;

    // All deployed markets
    address[] public markets;
    mapping(address => bool) public isMarket;

    // Contracts authorized to call createMarketWithCustomSeed (e.g. Dutch Auction)
    mapping(address => bool) public authorizedCreators;

    // Initial seed liquidity per side when factory creates a market
    uint256 public seedLiquidityPerSide = 100 * 1e6; // 100 USDC each side = 200 total

    event MarketCreated(
        address indexed market,
        string  question,
        uint256 duration,
        address creator,
        uint256 index
    );

    event SeedLiquidityUpdated(uint256 newAmount);
    event ProtocolUpdated(address newProtocol);
    event AuthorizedCreatorSet(address indexed creator, bool authorized);

    constructor(address _usdc, address _oracle, address _protocol) Ownable(msg.sender) {
        usdc     = IERC20(_usdc);
        oracle   = _oracle;
        protocol = _protocol;
    }

    /// @notice Create a new prediction market.
    /// @param question  The market question (e.g. "Will ETH exceed $5000 by Dec 2025?")
    /// @param duration  Seconds until market expires
    function createMarket(string calldata question, uint256 duration)
        external
        returns (address market)
    {
        require(bytes(question).length > 0, "Empty question");
        require(duration >= 1 hours && duration <= 365 days, "Invalid duration");

        // Deploy market
        market = address(new VeritasMarket(
            address(usdc),
            oracle,
            address(this),
            protocol,
            question,
            duration
        ));

        // Pull seed liquidity from caller and hand to market
        uint256 seedTotal = seedLiquidityPerSide * 2;
        usdc.safeTransferFrom(msg.sender, address(this), seedTotal);
        usdc.approve(market, seedTotal);
        VeritasMarket(market).seedLiquidity(address(this), seedLiquidityPerSide, seedLiquidityPerSide);
        // Transfer the bootstrap LP shares to the caller to avoid locking them in factory.
        VeritasMarket(market).transferInitialLPShares(msg.sender, seedLiquidityPerSide, seedLiquidityPerSide);

        markets.push(market);
        isMarket[market] = true;

        emit MarketCreated(market, question, duration, msg.sender, markets.length - 1);
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function setSeedLiquidity(uint256 amount) external onlyOwner {
        require(amount >= 10 * 1e6, "Min 10 USDC per side");
        seedLiquidityPerSide = amount;
        emit SeedLiquidityUpdated(amount);
    }

    function setProtocol(address _protocol) external onlyOwner {
        require(_protocol != address(0), "Zero address");
        protocol = _protocol;
        emit ProtocolUpdated(_protocol);
    }

    function setAuthorizedCreator(address creator, bool authorized) external onlyOwner {
        require(creator != address(0), "Zero address");
        authorizedCreators[creator] = authorized;
        emit AuthorizedCreatorSet(creator, authorized);
    }

    /// @notice Create a market with custom (asymmetric) seed amounts.
    ///         Called by authorized launch engines (e.g. Dutch Auction, Ignition).
    ///         LP shares are initially moved to the caller, which can then distribute them.
    /// @param question      Market question
    /// @param duration      Seconds until expiry
    /// @param seedYes       USDC seeded into the YES reserve
    /// @param seedNo        USDC seeded into the NO reserve
    function createMarketWithCustomSeed(
        string calldata question,
        uint256 duration,
        uint256 seedYes,
        uint256 seedNo
    ) external returns (address market) {
        require(authorizedCreators[msg.sender] || msg.sender == owner(), "Not authorized");
        require(bytes(question).length > 0, "Empty question");
        require(duration >= 1 hours && duration <= 365 days, "Invalid duration");
        require(seedYes > 0 && seedNo > 0, "Zero seed");

        market = address(new VeritasMarket(
            address(usdc),
            oracle,
            address(this),
            protocol,
            question,
            duration
        ));

        // Pull total USDC from caller (auction contract) into factory
        uint256 seedTotal = seedYes + seedNo;
        usdc.safeTransferFrom(msg.sender, address(this), seedTotal);
        usdc.approve(market, seedTotal);

        // Seed market; factory is `from`, so LP shares temporarily sit in factory
        VeritasMarket(market).seedLiquidity(address(this), seedYes, seedNo);

        // Move LP shares from factory → auction contract
        VeritasMarket(market).transferInitialLPShares(msg.sender, seedYes, seedNo);

        // Register auction as authorized to distribute LP shares to bidders
        VeritasMarket(market).setDutchAuction(msg.sender);

        markets.push(market);
        isMarket[market] = true;

        emit MarketCreated(market, question, duration, msg.sender, markets.length - 1);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    /// @notice Return all market addresses (use pagination for large sets)
    function getMarkets(uint256 offset, uint256 limit)
        external view returns (address[] memory result)
    {
        uint256 total = markets.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = markets[i];
        }
    }

    /// @notice Batch fetch market info for all markets
    function getMarketsInfo(uint256 offset, uint256 limit)
        external view returns (
            address[] memory addrs,
            string[]  memory questions,
            uint256[] memory reservesYes,
            uint256[] memory reservesNo,
            bool[]    memory settledFlags,
            uint256[] memory expiresAts
        )
    {
        uint256 total = markets.length;
        if (offset >= total) {
            return (
                new address[](0), new string[](0), new uint256[](0),
                new uint256[](0), new bool[](0), new uint256[](0)
            );
        }
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 len = end - offset;

        addrs       = new address[](len);
        questions   = new string[](len);
        reservesYes = new uint256[](len);
        reservesNo  = new uint256[](len);
        settledFlags = new bool[](len);
        expiresAts  = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address m = markets[offset + i];
            VeritasMarket vm = VeritasMarket(m);
            addrs[i]        = m;
            questions[i]    = vm.question();
            reservesYes[i]  = vm.reserveYes();
            reservesNo[i]   = vm.reserveNo();
            settledFlags[i] = vm.settled();
            expiresAts[i]   = vm.expiresAt();
        }
    }
}
