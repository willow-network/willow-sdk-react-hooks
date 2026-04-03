import { useCallback, useState, useMemo } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { QueryRequest, QueryResponse } from '@willow/sdk';
import { useWillow } from './useWillow';

interface UseQueryOptions extends SWRConfiguration {
  /**
   * Whether to skip proof verification for performance.
   * Default is false (proofs are verified).
   */
  skipVerification?: boolean;
}

/**
 * Hook for querying indexed data with automatic proof verification
 */
export function useQuery(
  datasetId: string,
  query: QueryRequest | null,
  options?: UseQueryOptions
) {
  const { client, isAuthenticated } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !isAuthenticated || !query) {
      return null;
    }

    // Use unverified method if skipVerification is true
    if (options?.skipVerification) {
      return client.data.queryUnverified(datasetId, query);
    }

    // Default to verified query
    return client.data.query(datasetId, query);
  }, [client, isAuthenticated, datasetId, query, options?.skipVerification]);

  // Create a stable key for SWR
  const swrKey = client && isAuthenticated && query
    ? ['query', datasetId, JSON.stringify(query)]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<QueryResponse | null>(
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
    documents: data?.documents || [],
    total: data?.total ?? 0,
    hasMore: data && data.total != null && data.offset != null && data.limit != null
      ? (data.offset + data.limit) < data.total
      : false,
  };
}

/**
 * Hook for paginated queries
 */
export function usePaginatedQuery(
  datasetId: string,
  baseQuery: Omit<QueryRequest, 'offset' | 'limit'>,
  pageSize: number = 20,
  options?: UseQueryOptions
) {
  const [page, setPage] = useState(0);

  const query = useMemo(() => ({
    ...baseQuery,
    offset: page * pageSize,
    limit: pageSize
  }), [baseQuery, page, pageSize]);

  const result = useQuery(datasetId, query, options);

  const nextPage = useCallback(() => {
    if (result.hasMore) {
      setPage(p => p + 1);
    }
  }, [result.hasMore]);

  const previousPage = useCallback(() => {
    setPage(p => Math.max(0, p - 1));
  }, []);

  const goToPage = useCallback((pageNumber: number) => {
    setPage(Math.max(0, pageNumber));
  }, []);

  return {
    ...result,
    page,
    pageSize,
    totalPages: result.data?.total ? Math.ceil(result.data.total / pageSize) : 0,
    nextPage,
    previousPage,
    goToPage,
    hasNextPage: result.hasMore,
    hasPreviousPage: page > 0,
  };
}