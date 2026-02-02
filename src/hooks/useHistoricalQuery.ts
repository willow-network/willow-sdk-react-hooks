import { useCallback, useState } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { HistoricalQueryRequest, HistoricalQueryResponse, CheckpointInfo } from '@willow/sdk';
import { useWillow } from './useWillow';

interface UseHistoricalQueryOptions extends SWRConfiguration {
  /**
   * Whether to skip proof verification for performance.
   * Default is false (proofs are verified against checkpoint state root).
   */
  skipVerification?: boolean;
}

/**
 * Hook for querying historical indexed data from checkpoints.
 *
 * Historical queries retrieve data from indexer nodes that have preserved
 * checkpoint data. By default, proofs are verified against the checkpoint's
 * state root for trustless verification.
 *
 * @example
 * ```tsx
 * function HistoricalDataViewer({ subgroveId, checkpointId }) {
 *   const { data, error, isLoading } = useHistoricalQuery(
 *     subgroveId,
 *     checkpointId,
 *     {
 *       path: [new TextEncoder().encode('blocks')],
 *       key: new TextEncoder().encode('12345'),
 *       query_type: 'get',
 *       include_proof: true
 *     }
 *   );
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <p>Provider: {data?.provider_did}</p>
 *       <p>Block range: {data?.block_range?.[0]} - {data?.block_range?.[1]}</p>
 *       <pre>{JSON.stringify(data?.data, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useHistoricalQuery(
  subgroveId: string | null,
  checkpointId: string | null,
  query: HistoricalQueryRequest | null,
  options?: UseHistoricalQueryOptions
) {
  const { client, isAuthenticated } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !isAuthenticated || !subgroveId || !checkpointId || !query) {
      return null;
    }

    // Use unverified method if skipVerification is true
    if (options?.skipVerification) {
      return client.data.queryHistorical(subgroveId, checkpointId, query);
    }

    // Default to verified query
    return client.data.queryHistoricalVerified(subgroveId, checkpointId, query);
  }, [client, isAuthenticated, subgroveId, checkpointId, query, options?.skipVerification]);

  // Create a stable key for SWR
  const swrKey = client && isAuthenticated && subgroveId && checkpointId && query
    ? ['historicalQuery', subgroveId, checkpointId, JSON.stringify(query)]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<HistoricalQueryResponse | null>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  const refetch = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    refetch,
    // Convenience accessors
    success: data?.success ?? false,
    providerDid: data?.provider_did,
    stateRoot: data?.state_root,
    blockRange: data?.block_range,
    canReindex: data?.can_reindex ?? false,
  };
}

/**
 * Hook for fetching checkpoint state root information.
 *
 * Use this to get checkpoint metadata before making historical queries,
 * or to verify proofs against the checkpoint's state root.
 *
 * @example
 * ```tsx
 * function CheckpointInfo({ subgroveId, checkpointId }) {
 *   const { checkpoint, isLoading, error } = useCheckpointStateRoot(
 *     subgroveId,
 *     checkpointId
 *   );
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <p>State Root: {checkpoint?.state_root}</p>
 *       <p>Block Range: {checkpoint?.block_range?.[0]} - {checkpoint?.block_range?.[1]}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCheckpointStateRoot(
  subgroveId: string | null,
  checkpointId: string | null,
  options?: SWRConfiguration
) {
  const { client, isAuthenticated } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !isAuthenticated || !subgroveId || !checkpointId) {
      return null;
    }

    return client.data.getCheckpointStateRoot(subgroveId, checkpointId);
  }, [client, isAuthenticated, subgroveId, checkpointId]);

  // Create a stable key for SWR
  const swrKey = client && isAuthenticated && subgroveId && checkpointId
    ? ['checkpointStateRoot', subgroveId, checkpointId]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<CheckpointInfo | null>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  const refetch = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    checkpoint: data,
    error,
    isLoading,
    isValidating,
    refetch,
    // Convenience accessors
    stateRoot: data?.state_root,
    blockRange: data?.block_range,
  };
}

/**
 * Hook for executing historical queries with manual control.
 *
 * Unlike useHistoricalQuery, this hook returns a function that executes
 * the query on demand rather than automatically. Useful for user-triggered
 * queries or when you need more control over when queries execute.
 *
 * @example
 * ```tsx
 * function ManualHistoricalQuery({ subgroveId, checkpointId }) {
 *   const { executeQuery, isExecuting, lastResult, lastError } = useHistoricalQueryMutation();
 *
 *   const handleQuery = async () => {
 *     try {
 *       const result = await executeQuery(subgroveId, checkpointId, {
 *         path: [new TextEncoder().encode('blocks')],
 *         query_type: 'get_path',
 *         include_proof: true
 *       });
 *       console.log('Query result:', result);
 *     } catch (error) {
 *       console.error('Query failed:', error);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleQuery} disabled={isExecuting}>
 *       {isExecuting ? 'Querying...' : 'Execute Query'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useHistoricalQueryMutation(options?: { skipVerification?: boolean }) {
  const { client, isAuthenticated } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<HistoricalQueryResponse | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const executeQuery = useCallback(async (
    subgroveId: string,
    checkpointId: string,
    query: HistoricalQueryRequest
  ): Promise<HistoricalQueryResponse> => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsExecuting(true);
    setLastError(null);

    try {
      const result = options?.skipVerification
        ? await client.data.queryHistorical(subgroveId, checkpointId, query)
        : await client.data.queryHistoricalVerified(subgroveId, checkpointId, query);

      setLastResult(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      throw err;
    } finally {
      setIsExecuting(false);
    }
  }, [client, isAuthenticated, options?.skipVerification]);

  return {
    executeQuery,
    isExecuting,
    lastResult,
    lastError,
  };
}
