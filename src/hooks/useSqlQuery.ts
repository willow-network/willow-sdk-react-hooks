import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

export interface SqlQueryResponse {
  columns: string[];
  rows: any[][];
  total?: number;
  warnings?: string[];
  proof?: any;
}

interface UseSqlQueryOptions extends SWRConfiguration {
  includeProof?: boolean;
  skip?: boolean;
}

/**
 * Hook for executing SQL queries against a subgrove.
 *
 * @param subgroveId - The subgrove to query
 * @param sql - SQL SELECT query string (pass null to skip)
 * @param options - Query options including proof and SWR config
 *
 * @example
 * ```tsx
 * const { columns, rows, total, isLoading } = useSqlQuery(
 *   'my-subgrove',
 *   "SELECT id, name, symbol FROM tokens WHERE decimals > 6 ORDER BY name LIMIT 10"
 * );
 * ```
 */
export function useSqlQuery(
  subgroveId: string | null,
  sql: string | null,
  options?: UseSqlQueryOptions
) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SqlQueryResponse | null> => {
    if (!config || !subgroveId || !sql || options?.skip) return null;

    const response = await fetch(`${config.apiUrl}/sql/${encodeURIComponent(subgroveId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: sql,
        include_proof: options?.includeProof ?? false,
      }),
    });

    if (!response.ok) {
      throw new Error('SQL query failed');
    }

    const data = await response.json();

    // Handle both direct response and wrapped API response
    if (data.success !== undefined) {
      if (!data.success) {
        throw new Error(data.error || 'SQL query failed');
      }
      return data.data;
    }

    return data;
  }, [config, subgroveId, sql, options?.includeProof, options?.skip]);

  const swrKey = config && subgroveId && sql && !options?.skip
    ? ['sql', subgroveId, sql, options?.includeProof ?? false]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    data,
    columns: data?.columns ?? [],
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    warnings: data?.warnings,
    proof: data?.proof,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}
