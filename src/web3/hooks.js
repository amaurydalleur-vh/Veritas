/**
 * hooks.js
 * Custom React hooks for reading/writing Veritas contracts via wagmi.
 */

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
    query: { enabled: !!ADDRESSES.factory, refetchInterval: 10_000 },
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
