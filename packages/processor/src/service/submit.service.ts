import {
  type ContractCallOptionsEthers,
  type ContractCallParameters,
  type RetryOptionsEthers,
  WithdrawalAbi,
  LzRelayAbi,
  Withdrawal__factory,
  calculateEthersIncreasedGasPrice,
  calculateGasMultiplier,
  config,
  createNetworkClient,
  ethersWaitForTransactionConfirmation,
  executeEthersTransaction,
  getEthersMaxGasMultiplier,
  getEthersTxOptions,
  getNonce,
  getWalletClient,
  logger,
  replacedEthersTransaction,
} from "@intmax2-withdrawal-aggregator/shared";
import { ethers } from "ethers";
import { type Abi, type PublicClient } from "viem";
import {
  ETHERS_CONFIRMATIONS,
  ETHERS_WAIT_TRANSACTION_TIMEOUT_MESSAGE,
  TRANSACTION_MAX_RETRIES,
  TRANSACTION_MISSING_REVERT_DATA,
  TRANSACTION_REPLACEMENT_FEE_TOO_LOW,
  WAIT_TRANSACTION_TIMEOUT,
  GAS_LIMIT,
  MSG_VALUE,
  DST_EID,
} from "../constants";
import type { SubmitWithdrawalParams } from "../types";
import { Options } from '@layerzerolabs/lz-v2-utilities';

export const submitWithdrawalProof = async (
  params: SubmitWithdrawalParams,
  walletClientData: ReturnType<typeof getWalletClient>,
) => {
  const ethereumClient = createNetworkClient("scroll");

  const retryOptions: RetryOptionsEthers = {
    gasPrice: null,
  };

  for (let attempt = 0; attempt < TRANSACTION_MAX_RETRIES; attempt++) {
    try {
      const multiplier = calculateGasMultiplier(attempt);

      const { transactionHash } = await submitWithdrawalProofWithRetry(
        ethereumClient,
        walletClientData,
        params,
        multiplier,
        retryOptions,
      );

      const receipt = await ethersWaitForTransactionConfirmation(
        ethereumClient,
        transactionHash,
        "submitWithdrawalProof",
        {
          confirms: ETHERS_CONFIRMATIONS,
          timeout: WAIT_TRANSACTION_TIMEOUT,
        },
      );

      return receipt;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`Error sending transaction: ${message}`);

      if (attempt === TRANSACTION_MAX_RETRIES - 1) {
        throw new Error("Transaction Max retries reached");
      }

      if (
        message.includes(ETHERS_WAIT_TRANSACTION_TIMEOUT_MESSAGE) ||
        message.includes(TRANSACTION_REPLACEMENT_FEE_TOO_LOW) ||
        message.includes(TRANSACTION_MISSING_REVERT_DATA)
      ) {
        logger.warn(`Attempt ${attempt + 1} failed. Retrying with higher gas...`);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unexpected end of transaction");
};

export const submitWithdrawalProofWithRetry = async (
  ethereumClient: PublicClient,
  walletClientData: ReturnType<typeof getWalletClient>,
  params: SubmitWithdrawalParams,
  multiplier: number,
  retryOptions: RetryOptionsEthers,
) => {
  const options = Options.newOptions()
    .addExecutorLzReceiveOption(GAS_LIMIT, MSG_VALUE)
    .toBytes();

  const contractCallParams: ContractCallParameters = {
    contractAddress: config.WITHDRAWAL_CONTRACT_ADDRESS as `0x${string}`,
    abi: WithdrawalAbi as Abi,
    functionName: "submitWithdrawalProof((address,uint32,uint256,bytes32,bytes32,uint32)[],(bytes32,address),bytes,uint32,bytes)",
    account: walletClientData.account,
    args: [params.contractWithdrawals, params.publicInputs, params.proof, DST_EID, options],
  };

  logger.info(`service hash: ${params.publicInputs.lastWithdrawalHash}`);
  

  const [{ pendingNonce, currentNonce }, gasPriceData] = await Promise.all([
    getNonce(ethereumClient, walletClientData.account.address),
    getEthersMaxGasMultiplier(ethereumClient, multiplier),
  ]);
  let { gasPrice } = gasPriceData;

  if (retryOptions.gasPrice) {
    const { newGasPrice } = calculateEthersIncreasedGasPrice(retryOptions.gasPrice, gasPrice);

    gasPrice = newGasPrice;

    logger.info(`Increased gas fees multiplier: ${multiplier} - gasPrice: ${gasPrice}`);
  }

  retryOptions.gasPrice = gasPrice;

  const contractCallOptions: ContractCallOptionsEthers = {
    nonce: currentNonce,
    gasPrice,
  };

  const provider = new ethers.JsonRpcProvider(ethereumClient.transport.url);
  
  // ToDo: make this also work with mnemonic
  const signer = new ethers.Wallet(config.INTMAX2_OWNER_PRIVATE_KEY, provider);
  const contract = Withdrawal__factory.connect(contractCallParams.contractAddress, signer);

  const lzRelayer = new ethers.Contract(config.SCROLL_SEPOLIA_RELAYER_CONTRACT_ADDRESS!, LzRelayAbi, signer);

  const withdrawalTuples = params.contractWithdrawals.map(w => [
    w.recipient,
    w.tokenIndex,
    w.amount,
    w.nullifier,
    w.blockHash,
    w.blockNumber
  ]);

  const abiCoder = new ethers.AbiCoder()
  const payload = abiCoder.encode(
    ["tuple(address,uint32,uint256,bytes32,bytes32,uint32)[]", "tuple(bytes32,address)", "bytes", "uint32", "bytes"],
    [
      withdrawalTuples,
      [params.publicInputs.lastWithdrawalHash, params.publicInputs.withdrawalAggregator],
      params.proof,
      DST_EID,
      options,
    ]
  )

  const fee = await lzRelayer.quote(DST_EID, payload, options, false);
  console.log("Estimated fee:", fee.nativeFee.toString())

  const ethersTxOptions = getEthersTxOptions(contractCallParams, contractCallOptions ?? { value: fee.nativeFee, gasLimit: GAS_LIMIT });
  const callArgs = [
    contractCallParams.args[0],
    contractCallParams.args[1],
    contractCallParams.args[2],
    contractCallParams.args[3],
    contractCallParams.args[4],
    ethersTxOptions,
  ];

  if (pendingNonce > currentNonce) {
    return await replacedEthersTransaction({
      functionName: contractCallParams.functionName,
      contract,
      callArgs,
    });
  }

  const transactionResult = await executeEthersTransaction({
    functionName: contractCallParams.functionName,
    contract,
    callArgs,
  });

  return transactionResult;
};
