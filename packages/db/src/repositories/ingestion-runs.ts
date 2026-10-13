import type { ObjectId } from "mongodb";
import type { IngestionRun } from "@sibs/core";
import { collections } from "../client";

export async function startIngestionRun(run: IngestionRun): Promise<ObjectId> {
  const { ingestionRuns } = await collections();
  return (await ingestionRuns.insertOne(run)).insertedId;
}

export async function finishIngestionRun(id: ObjectId, run: IngestionRun): Promise<void> {
  const { ingestionRuns } = await collections();
  await ingestionRuns.replaceOne({ _id: id }, run);
}

export async function lastIngestionRun({ finished = false } = {}): Promise<IngestionRun | null> {
  const { ingestionRuns } = await collections();
  return ingestionRuns.find(finished ? { finishedAt: { $ne: null } } : {}).sort({ startedAt: -1 }).limit(1).next();
}
