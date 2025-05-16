import type { PollOptions } from "./types";
import { EndpointId } from '@layerzerolabs/lz-definitions';

// id
export const DEFAULT_ID_LENGTH = 20;

// LayerZero
export const GAS_LIMIT = 10_000_000;
export const MSG_VALUE = 0;
export const DST_EID = EndpointId.BASESEP_V2_TESTNET;

// poll
export const DEFAULT_POLL_OPTIONS: Required<PollOptions> = {
  maxAttempts: 30,
  intervalMs: 10_000,
  timeoutMs: 300_000,
};

// transaction
export const WAIT_TRANSACTION_TIMEOUT = 15_000;
export const TRANSACTION_MAX_RETRIES = 5;

// errors
export const TRANSACTION_WAIT_TIMEOUT_ERROR_MESSAGE =
  "Timed out while waiting for transaction with hash";
export const EXECUTION_REVERTED_ERROR_MESSAGE = "Execution reverted";
export const TRANSACTION_REPLACEMENT_FEE_TOO_LOW = "replacement fee too low";
export const TRANSACTION_MISSING_REVERT_DATA = "missing revert data"; // NOTE: because of the gasPrice

// ethers
export const ETHERS_WAIT_TRANSACTION_TIMEOUT_MESSAGE = "timeout";
export const ETHERS_CONFIRMATIONS = 1;
