import { useCallback, useState } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

// Indexing types (matching Rust SDK)
export interface SubgroveInfo {
  subgrove_id: string;
  name: string;
  description?: string;
  network: string;
  start_block: number;
  current_block?: number;
  status: SubgroveStatus;
  created_at: number;
  updated_at: number;
}

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

interface UseSubgrovesOptions extends SWRConfiguration {}

/**
 * Hook for listing all available subgroves
 */
export function useSubgroves(options?: UseSubgrovesOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgroveInfo[] | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/subgroves`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgroves');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subgroves');
    }

    return data.data || [];
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['subgroves'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    subgroves: data || [],
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a specific subgrove
 */
export function useSubgrove(subgroveId: string | null, options?: UseSubgrovesOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgroveInfo | null> => {
    if (!config || !subgroveId) return null;

    const response = await fetch(`${config.apiUrl}/subgroves/${encodeURIComponent(subgroveId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgrove');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Subgrove not found');
    }

    return data.data;
  }, [config, subgroveId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && subgroveId ? ['subgroves', subgroveId] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    subgrove: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching subgrove indexing status
 */
export function useSubgroveStatus(subgroveId: string | null, options?: UseSubgrovesOptions) {
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
export function useIndexers(options?: UseSubgrovesOptions) {
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
export function useIndexer(indexerDid: string | null, options?: UseSubgrovesOptions) {
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
export function useVerificationStats(options?: UseSubgrovesOptions) {
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
 * Hook for executing GraphQL queries against a subgrove
 */
export function useGraphQL(
  subgroveId: string | null,
  query: string | null,
  options?: UseGraphQLOptions
) {
  const { config } = useWillow();
  const [isExecuting, setIsExecuting] = useState(false);

  const fetcher = useCallback(async (): Promise<GraphQLResponse | null> => {
    if (!config || !subgroveId || !query || options?.skip) return null;

    const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgroveId)}`, {
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
  }, [config, subgroveId, query, options?.variables, options?.skip]);

  const swrKey = config && subgroveId && query && !options?.skip
    ? ['graphql', subgroveId, query, JSON.stringify(options?.variables || {})]
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
    if (!config || !subgroveId) {
      throw new Error('Client not initialized or subgrove ID not provided');
    }

    setIsExecuting(true);

    try {
      const response = await fetch(`${config.apiUrl}/graphql/${encodeURIComponent(subgroveId)}`, {
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
  }, [config, subgroveId, query, options?.variables]);

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
