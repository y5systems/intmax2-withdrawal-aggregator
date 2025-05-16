import { http, createWalletClient, type Account } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { config } from "../config";
import { networkConfig } from "./network";

type WalletType = "builder" | "depositAnalyzer" | "withdrawal";

const walletConfigs: Record<WalletType, number> = {
  builder: 0,
  depositAnalyzer: 1,
  withdrawal: 2,
};

export const getWalletClient = (
  type: WalletType,
  network: "ethereum" | "scroll",
) : {
  account: Account;
  walletClient: ReturnType<typeof createWalletClient>;
} => {
  let account: Account;

  if (config.INTMAX2_OWNER_PRIVATE_KEY) {
    // Use private key if available
    account = privateKeyToAccount(config.INTMAX2_OWNER_PRIVATE_KEY as `0x${string}`);
  } else if (config.INTMAX2_OWNER_MNEMONIC) {
    // Fall back to mnemonic if available
    const addressIndex = walletConfigs[type];
    if (addressIndex === undefined) {
      throw new Error(`Invalid wallet type: ${type}`);
    }
    account = mnemonicToAccount(config.INTMAX2_OWNER_MNEMONIC, {
      accountIndex: 0,
      addressIndex,
    });
  } else {
    throw new Error("No private key or mnemonic provided in configuration");
  }

  const { chain, rpcUrl } = networkConfig[network][config.NETWORK_ENVIRONMENT];

  const client = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return {
    account,
    walletClient: client,
  };
};
