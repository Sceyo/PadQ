export interface V1EventCapacityInput {
  viewers: number;
  matchResults: number;
  historyViewers: number;
  operationalUpdates: number;
  sessionDocumentBytes: number;
  historyDocumentBytes: number;
}

export interface V1EventCapacityEstimate {
  reads: number;
  writes: number;
  deletesOnCleanup: number;
  storageBytesBeforeCleanup: number;
  transferBytes: number;
}

/**
 * Conservative Spark-plan estimate. It counts the watch page's one-time room
 * lookup separately from its live listener, assumes the host also listens to
 * session/history, and treats every operational update as revision-sensitive.
 */
export function estimateV1EventCapacity(input: V1EventCapacityInput): V1EventCapacityEstimate {
  const sessionUpdates = 2 + input.operationalUpdates + input.matchResults;
  const viewerSessionReads = input.viewers * (2 + sessionUpdates);
  const hostSessionReads = 1 + sessionUpdates;
  const transactionReads = 1 + input.operationalUpdates + input.matchResults * 2;
  const historyReads = (input.historyViewers + 1) * (1 + input.matchResults);
  const reads = viewerSessionReads + hostSessionReads + transactionReads + historyReads;

  const writes = 3 + input.operationalUpdates + input.matchResults * 2;
  const deletesOnCleanup = 1 + input.matchResults;
  const storageBytesBeforeCleanup =
    input.sessionDocumentBytes + input.matchResults * input.historyDocumentBytes;
  const transferBytes =
    (viewerSessionReads + hostSessionReads + transactionReads) * input.sessionDocumentBytes
    + historyReads * input.historyDocumentBytes;

  return { reads, writes, deletesOnCleanup, storageBytesBeforeCleanup, transferBytes };
}
