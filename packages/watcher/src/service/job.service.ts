import { createNetworkClient, eventDB, eventSchema } from "@intmax2-withdrawal-aggregator/shared";
import { inArray } from "drizzle-orm";
import { WITHDRAWAL_EVENT_NAMES } from "../types";
import { handleAllWithdrawalEvents } from "./event.service";
import { batchUpdateWithdrawalStatusTransactions } from "./withdrawal.service";

export const performJob = async (): Promise<void> => {
  // const ethereumClient = createNetworkClient("ethereum");
  const ethereumClient = createNetworkClient("base");

  const [events, currentBlockNumber] = await Promise.all([
    eventDB.select().from(eventSchema).where(inArray(eventSchema.name, WITHDRAWAL_EVENT_NAMES)),
    ethereumClient.getBlockNumber(),
  ]);

  const { directWithdrawals, claimableWithdrawals, claimedWithdrawals } =
    await handleAllWithdrawalEvents(ethereumClient, currentBlockNumber, events);

  await batchUpdateWithdrawalStatusTransactions(
    directWithdrawals,
    claimableWithdrawals,
    claimedWithdrawals,
  );

  await eventDB.transaction(async (tx) => {
    for (const eventName of WITHDRAWAL_EVENT_NAMES) {
      await tx
        .insert(eventSchema)
        .values({
          name: eventName,
          lastBlockNumber: currentBlockNumber,
        })
        .onConflictDoUpdate({
          target: eventSchema.name,
          set: {
            lastBlockNumber: currentBlockNumber,
          },
        });
    }
  });
};
