import { http, type Chain, type PublicClient, createPublicClient } from "viem";
import { mainnet, scroll, scrollSepolia, sepolia, baseSepolia, base } from "viem/chains";
import { config } from "../config";

export const networkConfig = {
  ethereum: {
    mainnet: {
      chain: mainnet,
      rpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${config.ALCHEMY_API_KEY}`,
    },
    sepolia: {
      chain: sepolia,
      rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
  },
  scroll: {
    mainnet: {
      chain: scroll,
      rpcUrl: `https://scroll-mainnet.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
    sepolia: {
      chain: scrollSepolia,
      rpcUrl: `https://scroll-sepolia.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
  },
  base: {
    mainnet: {
      chain: base,
      rpcUrl: `https://scroll-mainnet.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
    sepolia: {
      chain: baseSepolia,
      rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`,
    },
  },
};

export const createNetworkClient = (network: "base" | "scroll") => {
  const { chain, rpcUrl } = networkConfig[network][config.NETWORK_ENVIRONMENT];

  return createPublicClient({
    batch: {
      multicall: true,
    },
    chain: chain as Chain,
    transport: http(rpcUrl),
  }) as PublicClient;
};
