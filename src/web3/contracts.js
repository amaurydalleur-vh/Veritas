/**
 * contracts.js
 * Central registry of deployed contract addresses + ABIs.
 * Addresses come from .env (set after running npm run deploy:testnet).
 */

import deploymentJson        from "../contracts/deployment.json";
import VeritasFactoryABI      from "../contracts/VeritasFactory.json";
import VeritasMarketABI       from "../contracts/VeritasMarket.json";
import VeritasIgnitionABI     from "../contracts/VeritasIgnition.json";
import MockUSDCABI            from "../contracts/MockUSDC.json";
import VeritasDutchAuctionABI from "../contracts/VeritasDutchAuction.json";

// Prefer env vars (set after deploy), fall back to deployment.json
export const ADDRESSES = {
  factory:     import.meta.env.VITE_FACTORY_ADDRESS      || deploymentJson.contracts?.VeritasFactory     || "",
  ignition:    import.meta.env.VITE_IGNITION_ADDRESS     || deploymentJson.contracts?.VeritasIgnition    || "",
  usdc:        import.meta.env.VITE_USDC_ADDRESS         || deploymentJson.contracts?.MockUSDC           || "",
  oracle:      import.meta.env.VITE_ORACLE_ADDRESS       || deploymentJson.contracts?.MockOracle         || "",
  dutchAuction: import.meta.env.VITE_DUTCH_AUCTION_ADDRESS || deploymentJson.contracts?.VeritasDutchAuction || "",
};

export const ABIS = {
  factory:     VeritasFactoryABI.abi,
  market:      VeritasMarketABI.abi,
  ignition:    VeritasIgnitionABI.abi,
  usdc:        MockUSDCABI.abi,
  dutchAuction: VeritasDutchAuctionABI.abi,
};

export const isDeployed = () => !!ADDRESSES.factory;
