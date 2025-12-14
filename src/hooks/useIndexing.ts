import { useCallback, useState } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

// Indexing types (matching Rust SDK)
export interface SubgraphInfo {
  subgraph_id: string;
  name: string;
  description?: string;
  network: string;
  start_block: number;
  current_block?: number;
  status: SubgraphStatus;
  created_at: number;
  updated_at: number;
}

export type SubgraphStatus = 'syncing' | 'synced' | 'failed' | 'paused';

export interface SubgraphIndexingStatus {
  subgraph_id: string;
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
  subgraphs_indexed: string[];
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

interface UseSubgraphsOptions extends SWRConfiguration {}

/**
 * Hook for listing all available subgraphs
 */
export function useSubgraphs(options?: UseSubgraphsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgraphInfo[] | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/subgraphs`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgraphs');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subgraphs');
    }

    return data.data || [];
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['subgraphs'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    subgraphs: data || [],
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a specific subgraph
 */
export function useSubgraph(subgraphId: string | null, options?: UseSubgraphsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgraphInfo | null> => {
    if (!config || !subgraphId) return null;

    const response = await fetch(`${config.apiUrl}/subgraphs/${encodeURIComponent(subgraphId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgraph');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Subgraph not found');
    }

    return data.data;
  }, [config, subgraphId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && subgraphId ? ['subgraphs', subgraphId] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    subgraph: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching subgraph indexing status
 */
export function useSubgraphStatus(subgraphId: string | null, options?: UseSubgraphsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgraphIndexingStatus | null> => {
    if (!config || !subgraphId) return null;

    const response = await fetch(`${config.apiUrl}/subgraphs/${encodeURIComponent(subgraphId)}/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgraph status');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Subgraph status not found');
    }

    return data.data;
  }, [config, subgraphId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && subgraphId ? ['subgraphs', subgraphId, 'status'] : null,
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
export function useIndexers(options?: UseSubgraphsOptions) {
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
export function useIndexer(indexerDid: string | null, options?: UseSubgraphsOptions) {
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
export function useVerificationStats(options?: UseSubgraphsOptions) {
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
}

/**
 * Hook for executing GraphQL queries against a subgraph
 */
export function useGraphQL(
  subgraphId: string | null,
  query: string | null,
  options?: UseGraphQLOptions
) {
  const { config } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);

  const fetcher = useCallback(async (): Promise<GraphQLResponse | null> => {
    if (!config || !subgraphId || !query || options?.skip) return null;

    const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgraphId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: options?.variables,
      }),
    });

    if (!response.ok) {
      throw new Error('GraphQL query failed');
    }

    const data = await response.json();

    // Handle both direct GraphQL response and wrapped API response
    if (data.success !== undefined) {
      if (!data.success) {
        throw new Error(data.error || 'GraphQL query failed');
      }
      return data.data;
    }

    return data;
  }, [config, subgraphId, query, options?.variables, options?.skip]);

  const swrKey = config && subgraphId && query && !options?.skip
    ? ['graphql', subgraphId, query, JSON.stringify(options?.variables || {})]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: options?.refreshInterval,
    }
  );

  /**
   * Manually execute a GraphQL query (for mutations or one-off queries)
   */
  const execute = useCallback(async (
    customQuery?: string,
    customVariables?: Record<string, any>
  ): Promise<GraphQLResponse> => {
    if (!config || !subgraphId) {
      throw new Error('Client not initialized or subgraph ID not provided');
    }

    setIsExecuting(true);

    try {
      const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgraphId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: customQuery || query,
          variables: customVariables || options?.variables,
        }),
      });

      if (!response.ok) {
        throw new Error('GraphQL query failed');
      }

      const data = await response.json();

      if (data.success !== undefined && !data.success) {
        throw new Error(data.error || 'GraphQL query failed');
      }

      return data.success !== undefined ? data.data : data;
    } finally {
      setIsExecuting(false);
    }
  }, [config, subgraphId, query, options?.variables]);

  return {
    data: data?.data,
    errors: data?.errors,
    proof: data?.proof,
    verifiedRootHash: data?.verified_root_hash,
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
export function useGraphQLMutation(subgraphId: string | null) {
  const { config } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (
    mutation: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse> => {
    if (!config || !subgraphId) {
      throw new Error('Client not initialized or subgraph ID not provided');
    }

    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgraphId)}`, {
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
  }, [config, subgraphId]);

  return {
    execute,
    isExecuting,
    error,
  };
}
