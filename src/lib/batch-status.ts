import type { Batch } from "./types.ts";

export const batchStatusLabels: Record<Batch["status"], string> = {
  open: "Dibuka", closed: "Ditutup", completed: "Selesai",
};

export function nextBatchStatus(status: Batch["status"]): Batch["status"] | null {
  return status === "open" ? "closed" : status === "closed" ? "completed" : null;
}

export function canChangeBatchStatus(from: Batch["status"], to: Batch["status"]) {
  return from === to || nextBatchStatus(from) === to;
}
