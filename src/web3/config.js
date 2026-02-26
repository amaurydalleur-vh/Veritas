import { createConfig, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// WalletConnect project ID — free at https://cloud.walletconnect.com
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || "veritas-testnet-demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Veritas Prediction Markets",
  projectId: WC_PROJECT_ID,
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(
      import.meta.env.VITE_ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc"
    ),
  },
});

export const CHAIN_ID = 421614; // Arbitrum Sepolia
