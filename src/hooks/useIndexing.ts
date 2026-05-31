import { useCallback, useState } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

// Indexing types (matching Rust SDK)

/** How long real-time indexed data is retained on consensus nodes. */
export type RetentionWindow =
  | { type: 'Blocks'; value: number }
  | { type: 'Seconds'; value: number }
  | { type: 'Indefinite' }
  | { type: 'VerifyOnly' };

export type SubgroveStatus = 'syncing' | 'synced' | 'failed' | 'paused';

export interface SubgroveIndexingStatus {
  subgrove_id: string;
  synced: boolean;
  health: 'healthy' | 'unhealthy' | 'failed';
  chains: ChainIndexingStatus[];
  entity_count: number;
  latest_block: number;
  chain_head_block: number;
  blocks_behind: number;
}

export interface ChainIndexingStatus {
  network: string;
  chain_head_block: number;
  earliest_block: number;
  latest_block: number;
}

export interface IndexerInfo {
  did: string;
  moniker?: string;
  endpoint: string;
  stake: string;
  status: IndexerStatus;
  subgroves_indexed: string[];
  total_queries_served: number;
  uptime_percentage: number;
}

export type IndexerStatus = 'active' | 'inactive' | 'jailed';

export interface GraphQLResponse {
  data?: any;
  errors?: GraphQLError[];
  proof?: string;
  verified_root_hash?: string;
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
}

export interface VerificationStats {
  total_queries: number;
  verified_queries: number;
  failed_verifications: number;
  average_verification_time_ms: number;
}

// useSubgroves / useSubgrove live in ./useRegistration — canonical location
// after the App+Subgrove flattening. They're typed against SubgroveRegistration
// (the actual server response shape), while the previous duplicates here were
// typed against an out-of-date SubgroveInfo that didn't match the API.

interface UseIndexingOptions extends SWRConfiguration {}

/**
 * Hook for fetching subgrove indexing status
 */
export function useSubgroveStatus(subgroveId: string | null, options?: UseIndexingOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgroveIndexingStatus | null> => {
    if (!config || !subgroveId) return null;

    const response = await fetch(`${config.apiUrl}/subgroves/${encodeURIComponent(subgroveId)}/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgrove status');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Subgrove status not found');
    }

    return data.data;
  }, [config, subgroveId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && subgroveId ? ['subgroves', subgroveId, 'status'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 10000, // Refresh status every 10 seconds
      ...options,
    }
  );

  return {
    status: data,
    synced: data?.synced || false,
    health: data?.health || 'unhealthy',
    blocksBehind: data?.blocks_behind || 0,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for listing all indexers
 */
export function useIndexers(options?: UseIndexingOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<IndexerInfo[] | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/indexers`);
    if (!response.ok) {
      throw new Error('Failed to fetch indexers');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch indexers');
    }

    return data.data || [];
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['indexers'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    indexers: data || [],
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a specific indexer
 */
export function useIndexer(indexerDid: string | null, options?: UseIndexingOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<IndexerInfo | null> => {
    if (!config || !indexerDid) return null;

    const response = await fetch(`${config.apiUrl}/indexers/${encodeURIComponent(indexerDid)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch indexer');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Indexer not found');
    }

    return data.data;
  }, [config, indexerDid]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && indexerDid ? ['indexers', indexerDid] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    indexer: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching verification statistics
 */
export function useVerificationStats(options?: UseIndexingOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<VerificationStats | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/verification/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch verification stats');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'No verification stats available');
    }

    return data.data;
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['verification', 'stats'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    stats: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

interface UseGraphQLOptions {
  variables?: Record<string, any>;
  skip?: boolean;
  refreshInterval?: number;
  /**
   * Where to send the query. See `QuerySource` in `@willow-network/sdk`:
   * - `'validator'`: consensus-verified chain-tip. Fails for VerifyOnly subgroves.
   * - `'indexer'`: historical/analytics via an indexer.
   * - `'auto'` (default): indexer if available, else validator with `fallback: true`.
   */
  source?: import('@willow-network/sdk').QuerySource;
}

/**
 * Hook for executing GraphQL queries against a subgrove.
 *
 * Uses the underlying SDK's source-routed `graphqlQuery`, so the hook's
 * result includes `source` / `fallback` / `indexerDid` telling you where
 * the data came from.
 */
export function useGraphQL(
  subgroveId: string | null,
  query: string | null,
  options?: UseGraphQLOptions
) {
  const { client } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);

  const fetcher = useCallback(async () => {
    if (!client || !subgroveId || !query || options?.skip) return null;
    return client.graphqlQuery(subgroveId, query, {
      variables: options?.variables,
      source: options?.source ?? 'auto',
    });
  }, [client, subgroveId, query, options?.variables, options?.skip, options?.source]);

  const swrKey = client && subgroveId && query && !options?.skip
    ? ['graphql', subgroveId, query, JSON.stringify(options?.variables || {}), options?.source ?? 'auto']
    : null;

  const { data: routed, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: options?.refreshInterval,
    }
  );

  /**
   * Manually execute a GraphQL query (for mutations or one-off queries).
   * Returns the raw GraphQL response for parity with the previous API.
   */
  const execute = useCallback(async (
    customQuery?: string,
    customVariables?: Record<string, any>
  ): Promise<GraphQLResponse> => {
    if (!client || !subgroveId) {
      throw new Error('Client not initialized or subgrove ID not provided');
    }

    setIsExecuting(true);

    try {
      const routed = await client.graphqlQuery(
        subgroveId,
        customQuery || query || '',
        {
          variables: customVariables || options?.variables,
          source: options?.source ?? 'auto',
        },
      );
      return routed.result as GraphQLResponse;
    } finally {
      setIsExecuting(false);
    }
  }, [client, subgroveId, query, options?.variables, options?.source]);

  const gql = routed?.result as GraphQLResponse | undefined;

  return {
    data: gql?.data,
    errors: gql?.errors,
    proof: gql?.proof,
    verifiedRootHash: (gql as any)?.verified_root_hash,
    /** Which backend served this query ("validator" | "indexer"). */
    source: routed?.source,
    /** True when `auto` routing fell back from indexer to validator. */
    fallback: routed?.fallback ?? false,
    /** DID of the indexer that served, when `source === 'indexer'`. */
    indexerDid: routed?.indexerDid,
    error,
    isLoading,
    isValidating,
    isExecuting,
    refetch: mutate,
    execute,
  };
}

/**
 * Hook for GraphQL mutations (convenience wrapper around useGraphQL)
 */
export function useGraphQLMutation(subgroveId: string | null) {
  const { config } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (
    mutation: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse> => {
    if (!config || !subgroveId) {
      throw new Error('Client not initialized or subgrove ID not provided');
    }

    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgroveId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error('GraphQL mutation failed');
      }

      const data = await response.json();

      if (data.success !== undefined && !data.success) {
        throw new Error(data.error || 'GraphQL mutation failed');
      }

      return data.success !== undefined ? data.data : data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsExecuting(false);
    }
  }, [config, subgroveId]);

  return {
    execute,
    isExecuting,
    error,
  };
}
