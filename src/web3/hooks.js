/**
 * hooks.js
 * Custom React hooks for reading/writing Veritas contracts via wagmi.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ABIS } from "./contracts.js";

// ─── Factory ──────────────────────────────────────────────────────────────

/** Total number of deployed markets */
export function useMarketCount() {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "marketCount",
    query: { enabled: !!ADDRESSES.factory },
  });
}

/** Paginated list of markets (returns addresses) */
export function useMarkets(offset = 0, limit = 20) {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "getMarkets",
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: !!ADDRESSES.factory },
  });
}

/** Batch market info for display in the UI */
export function useMarketsInfo(offset = 0, limit = 20) {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "getMarketsInfo",
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: !!ADDRESSES.factory, refetchInterval: 3_000 },
  });
}

// ─── Single Market ────────────────────────────────────────────────────────

/** Full market info (question, reserves, settled state, etc.) */
export function useMarketInfo(marketAddress) {
  return useReadContract({
    address: marketAddress,
    abi: ABIS.market,
    functionName: "marketInfo",
    query: { enabled: !!marketAddress, refetchInterval: 5_000 },
  });
}

/** Implied probability of YES outcome (returns bigint scaled to 1e18) */
export function useImpliedProbability(marketAddress) {
  return useReadContract({
    address: marketAddress,
    abi: ABIS.market,
    functionName: "impliedProbabilityYes",
    query: { enabled: !!marketAddress, refetchInterval: 5_000 },
  });
}

/** TVL of a single market in USDC (6 decimals) */
export function useMarketTVL(marketAddress) {
  return useReadContract({
    address: marketAddress,
    abi: ABIS.market,
    functionName: "tvl",
    query: { enabled: !!marketAddress, refetchInterval: 10_000 },
  });
}

/** User positions in a market */
export function useUserPositions(marketAddress, userAddress) {
  const yes = useReadContract({
    address: marketAddress,
    abi: ABIS.market,
    functionName: "positionYes",
    args: [userAddress],
    query: { enabled: !!marketAddress && !!userAddress },
  });
  const no = useReadContract({
    address: marketAddress,
    abi: ABIS.market,
    functionName: "positionNo",
    args: [userAddress],
    query: { enabled: !!marketAddress && !!userAddress },
  });
  return { positionYes: yes.data, positionNo: no.data };
}

// ─── Write: Trade ────────────────────────────────────────────────────────

/**
 * Hook to execute a trade on a market.
 * Caller must first approve USDC.
 */
export function useTrade() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const trade = (marketAddress, buyYes, amountUSDC, minOut = 0n) => {
    const amountIn = parseUnits(String(amountUSDC), 6);
    writeContract({
      address: marketAddress,
      abi: ABIS.market,
      functionName: "trade",
      args: [buyYes, amountIn, minOut],
    });
  };

  return { trade, hash, isPending, isConfirming, isSuccess, error };
}

/** Hook to add liquidity to a market */
export function useAddLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addLiquidity = (marketAddress, amountUSDC) => {
    const amount = parseUnits(String(amountUSDC), 6);
    writeContract({
      address: marketAddress,
      abi: ABIS.market,
      functionName: "addLiquidity",
      args: [amount],
    });
  };

  return { addLiquidity, hash, isPending, isConfirming, isSuccess, error };
}

/** Hook to remove liquidity from a market by bps fraction (1..10000) */
export function useRemoveLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const removeLiquidity = (marketAddress, fractionBps) => {
    writeContract({
      address: marketAddress,
      abi: ABIS.market,
      functionName: "removeLiquidity",
      args: [BigInt(fractionBps)],
    });
  };

  return { removeLiquidity, hash, isPending, isConfirming, isSuccess, error };
}

/** Hook to redeem winnings after settlement */
export function useRedeem() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const redeem = (marketAddress) => {
    writeContract({
      address: marketAddress,
      abi: ABIS.market,
      functionName: "redeem",
    });
  };

  return { redeem, hash, isPending, isConfirming, isSuccess, error };
}

// ─── USDC ─────────────────────────────────────────────────────────────────

/** USDC balance for a user */
export function useUSDCBalance(userAddress) {
  return useReadContract({
    address: ADDRESSES.usdc,
    abi: ABIS.usdc,
    functionName: "balanceOf",
    args: [userAddress],
    query: { enabled: !!userAddress && !!ADDRESSES.usdc, refetchInterval: 10_000 },
  });
}

/** USDC allowance for a spender */
export function useUSDCAllowance(userAddress, spenderAddress) {
  return useReadContract({
    address: ADDRESSES.usdc,
    abi: ABIS.usdc,
    functionName: "allowance",
    args: [userAddress, spenderAddress],
    query: { enabled: !!userAddress && !!spenderAddress && !!ADDRESSES.usdc },
  });
}

/** Approve USDC spend */
export function useApproveUSDC() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender, amountUSDC) => {
    const amount = parseUnits(String(amountUSDC), 6);
    writeContract({
      address: ADDRESSES.usdc,
      abi: ABIS.usdc,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

/** Claim free testnet USDC from faucet */
export function useFaucet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimFaucet = () => {
    writeContract({
      address: ADDRESSES.usdc,
      abi: ABIS.usdc,
      functionName: "faucet",
    });
  };

  return { claimFaucet, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Ignition ─────────────────────────────────────────────────────────────

/** Total launch count */
export function useLaunchCount() {
  return useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "launchCount",
    query: { enabled: !!ADDRESSES.ignition, refetchInterval: 15_000 },
  });
}

/** Get a single launch by ID */
export function useLaunch(id) {
  return useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "getLaunch",
    args: [BigInt(id)],
    query: { enabled: !!ADDRESSES.ignition && id !== undefined },
  });
}

/** Virtual probability for a launch */
export function useVirtualProbability(id) {
  return useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "virtualProbabilityYes",
    args: [BigInt(id)],
    query: { enabled: !!ADDRESSES.ignition && id !== undefined },
  });
}

/** Propose a new market via Ignition ($50 USDC) */
export function useProposeMarket() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const propose = (question) => {
    writeContract({
      address: ADDRESSES.ignition,
      abi: ABIS.ignition,
      functionName: "propose",
      args: [question],
    });
  };

  return { propose, hash, isPending, isConfirming, isSuccess, error };
}

/** Commit USDC to back a launch */
export function useCommit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const commit = (launchId, buyYes, amountUSDC) => {
    const amount = parseUnits(String(amountUSDC), 6);
    writeContract({
      address: ADDRESSES.ignition,
      abi: ABIS.ignition,
      functionName: "commit",
      args: [BigInt(launchId), buyYes, amount],
    });
  };

  return { commit, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Admin (owner-only) ───────────────────────────────────────────────────

/** Read the factory owner address */
export function useFactoryOwner() {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "owner",
    query: { enabled: !!ADDRESSES.factory },
  });
}

/** Check if the Dutch Auction contract is registered as an authorized creator */
export function useIsAuctionAuthorized() {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "authorizedCreators",
    args: [ADDRESSES.dutchAuction],
    query: { enabled: !!ADDRESSES.factory && !!ADDRESSES.dutchAuction },
  });
}

/** Register (or deregister) the Dutch Auction contract as an authorized creator */
export function useSetAuthorizedCreator() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setAuthorized = (creatorAddress, authorized) => {
    writeContract({
      address: ADDRESSES.factory,
      abi: ABIS.factory,
      functionName: "setAuthorizedCreator",
      args: [creatorAddress, authorized],
    });
  };

  return { setAuthorized, hash, isPending, isConfirming, isSuccess, error };
}

/** Create a regular (instant) market directly via factory. Caller must pre-approve USDC. */
export function useAdminCreateMarket() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createMarket = (question, durationSeconds) => {
    writeContract({
      address: ADDRESSES.factory,
      abi: ABIS.factory,
      functionName: "createMarket",
      args: [question, BigInt(durationSeconds)],
    });
  };

  return { createMarket, hash, isPending, isConfirming, isSuccess, error };
}

/** Get factory seed liquidity per side (USDC, 6 decimals) */
export function useSeedLiquidityPerSide() {
  return useReadContract({
    address: ADDRESSES.factory,
    abi: ABIS.factory,
    functionName: "seedLiquidityPerSide",
    query: { enabled: !!ADDRESSES.factory },
  });
}

/** Launch a Dutch Auction for a new curated market */
export function useCreateAuction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createAuction = (question, commitDuration, revealDuration, marketDuration) => {
    writeContract({
      address: ADDRESSES.dutchAuction,
      abi: ABIS.dutchAuction,
      functionName: "createAuction",
      args: [question, BigInt(commitDuration), BigInt(revealDuration), BigInt(marketDuration)],
    });
  };

  return { createAuction, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Order Book (CLOB) ────────────────────────────────────────────────────

/**
 * Order book depth for one side of a market across all price levels.
 * Returns { prices: uint8[], restingUSDC: bigint[] } or undefined while loading.
 */
export function useOrderBook(marketAddress, buyYes) {
  return useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "getOrderBook",
    args: [marketAddress, buyYes],
    query: { enabled: !!marketAddress && !!ADDRESSES.orderBook, refetchInterval: 5_000 },
  });
}

/** Best YES bid price in the book (highest price) */
export function useBestYesBid(marketAddress) {
  return useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "bestYesBid",
    args: [marketAddress],
    query: { enabled: !!marketAddress && !!ADDRESSES.orderBook, refetchInterval: 5_000 },
  });
}

/** Best NO bid price in the book */
export function useBestNoBid(marketAddress) {
  return useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "bestNoBid",
    args: [marketAddress],
    query: { enabled: !!marketAddress && !!ADDRESSES.orderBook, refetchInterval: 5_000 },
  });
}

/** User's CLOB position (USDC) for a market, for both sides */
export function useOrderBookPosition(marketAddress, userAddress) {
  const yes = useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "positionYes",
    args: [userAddress, marketAddress],
    query: { enabled: !!marketAddress && !!userAddress && !!ADDRESSES.orderBook },
  });
  const no = useReadContract({
    address: ADDRESSES.orderBook,
    abi: ABIS.orderBook,
    functionName: "positionNo",
    args: [userAddress, marketAddress],
    query: { enabled: !!marketAddress && !!userAddress && !!ADDRESSES.orderBook },
  });
  return { positionYes: yes.data, positionNo: no.data };
}

/**
 * Place a limit order on the CLOB.
 * Caller must first approve USDC to the OrderBook address.
 *
 * @param marketAddress  VeritasMarket contract address
 * @param buyYes         true = buy YES shares, false = buy NO shares
 * @param price          1–99 (implied probability % = cents per share)
 * @param sizeUSDC       Numeric USDC amount (e.g. 10 for 10 USDC)
 */
export function usePlaceOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeOrder = (marketAddress, buyYes, price, sizeUSDC) => {
    const size = parseUnits(String(sizeUSDC), 6);
    writeContract({
      address: ADDRESSES.orderBook,
      abi: ABIS.orderBook,
      functionName: "placeOrder",
      args: [marketAddress, buyYes, price, size],
    });
  };

  return { placeOrder, hash, isPending, isConfirming, isSuccess, error };
}

/** Cancel an open limit order and reclaim escrowed USDC */
export function useCancelOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelOrder = (orderId) => {
    writeContract({
      address: ADDRESSES.orderBook,
      abi: ABIS.orderBook,
      functionName: "cancelOrder",
      args: [BigInt(orderId)],
    });
  };

  return { cancelOrder, hash, isPending, isConfirming, isSuccess, error };
}

/** Claim settled CLOB position (winnings after market resolution) */
export function useClaimOrderBookPosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimPosition = (marketAddress) => {
    writeContract({
      address: ADDRESSES.orderBook,
      abi: ABIS.orderBook,
      functionName: "claimPosition",
      args: [marketAddress],
    });
  };

  return { claimPosition, hash, isPending, isConfirming, isSuccess, error };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Format USDC (6 decimals) → human-readable string */
export function formatUSDC(raw) {
  if (raw === undefined || raw === null) return "—";
  return Number(formatUnits(raw, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format probability (1e18 scaled) → percentage string */
export function formatProb(raw) {
  if (raw === undefined || raw === null) return "—";
  return (Number(raw) / 1e16).toFixed(1) + "%";
}
