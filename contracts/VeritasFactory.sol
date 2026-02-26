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
