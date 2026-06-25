import { useCallback } from "react";
import {
  canonicalEventSetHash,
  verifyServedEvents,
  Log,
} from "../completeness";
import {
  verifyBlockCompleteness as verifyBlockCompletenessFetch,
  CompletenessError,
} from "../completenessFetch";
import { useWillowContext } from "../providers/WillowProvider";

/**
 * Hook for client-side completeness verification.
 *
 * Wraps the pure {@link canonicalEventSetHash} / {@link verifyServedEvents}
 * helpers so a React app can confirm that an indexer's served matched-log set
 * for a (subgrove, block) is the complete, untampered event set the chain
 * attests to — by re-hashing the served preimage and comparing it against the
 * trusted on-chain `events_commitment` anchor. No indexer trust required.
 *
 * `verify` / `computeCommitment` are pure: pass the already-fetched commitment
 * and logs. `verifyBlockCompleteness(subgroveId, blockNumber)` does the full
 * round trip — it reads the anchor via the validator's CometBFT `abci_query`
 * (using the configured `consensusRpcUrl`) and the matched-log preimage from
 * the indexer (using the configured `indexerUrl`, or an explicit override).
 */
export function useCompletenessVerification(options?: {
  /** Indexer base URL override. Defaults to the SDK config's `indexerUrl`. */
  indexerBaseUrl?: string;
}) {
  const { config } = useWillowContext();

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

  /**
   * Full client-side completeness check: fetch the on-chain anchor and the
   * indexer's matched logs, then verify. Resolves to `true` iff the indexer
   * served exactly the chain's committed set. Throws {@link CompletenessError}
   * when either side is unavailable (no anchor yet, logs not retained, …) or
   * when the required URLs are not configured.
   */
  const verifyBlockCompleteness = useCallback(
    async (
      subgroveId: string,
      blockNumber: number | bigint,
    ): Promise<boolean> => {
      const rpcUrl = config?.consensusRpcUrl;
      if (!rpcUrl) {
        throw new CompletenessError(
          "consensusRpcUrl is not configured; set it on the WillowProvider config to read the on-chain anchor",
        );
      }
      const indexerBaseUrl = options?.indexerBaseUrl ?? config?.indexerUrl;
      if (!indexerBaseUrl) {
        throw new CompletenessError(
          "no indexer URL: set `indexerUrl` on the WillowProvider config or pass `indexerBaseUrl` to useCompletenessVerification",
        );
      }
      return verifyBlockCompletenessFetch({
        rpcUrl,
        indexerBaseUrl,
        subgroveId,
        blockNumber,
      });
    },
    [config?.consensusRpcUrl, config?.indexerUrl, options?.indexerBaseUrl],
  );

  return { computeCommitment, verify, verifyBlockCompleteness };
}
