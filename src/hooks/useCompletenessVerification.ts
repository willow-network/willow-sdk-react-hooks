import { useCallback } from "react";
import {
  canonicalEventSetHash,
  verifyServedEvents,
  Log,
} from "../completeness";

/**
 * Hook for client-side completeness verification.
 *
 * Wraps the pure {@link canonicalEventSetHash} / {@link verifyServedEvents}
 * helpers so a React app can confirm that an indexer's served matched-log set
 * for a (subgrove, block) is the complete, untampered event set the chain
 * attests to — by re-hashing the served preimage and comparing it against the
 * trusted on-chain `events_commitment` anchor. No indexer trust required.
 *
 * Fetching the anchor and preimage is left to the caller: this SDK's client
 * config exposes only a single `apiUrl` and no indexer HTTP client, so an
 * automatic `verifyBlockCompleteness(subgroveId, blockNumber)` is intentionally
 * not provided here. Fetch the anchor via the validator ABCI store query path
 * `events_commitment` (subgrove_id, block_number) and the preimage via the
 * indexer's `/completeness/{subgroveId}/{blockNumber}/matched-logs` endpoint,
 * then pass both to `verify`.
 */
export function useCompletenessVerification() {
  /** Re-derive the 32-byte canonical commitment from a served log set. */
  const computeCommitment = useCallback(
    (blockNumber: number | bigint, matchedLogs: Log[]): Uint8Array =>
      canonicalEventSetHash(blockNumber, matchedLogs),
    [],
  );

  /**
   * Verify a served log set against the on-chain commitment anchor.
   * Returns true iff the re-hashed set matches.
   */
  const verify = useCallback(
    (
      commitment: Uint8Array,
      blockNumber: number | bigint,
      matchedLogs: Log[],
    ): boolean => verifyServedEvents(commitment, blockNumber, matchedLogs),
    [],
  );

  return { computeCommitment, verify };
}
