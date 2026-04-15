import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import type { QuerySource } from '@willow/sdk';
import { useWillow } from './useWillow';

// Re-declared locally to avoid a tsup DTS bug where the SDK's nested
// QueryProof type clashes with a duplicated QueryProof$1 in the generated
// declarations. The runtime shape is identical to @willow/sdk's
// `RoutedQueryResult<SqlQueryResponse>`.
export interface SqlQueryHookResult {
  columns: string[];
  rows: any[][];
  total?: number;
  warnings?: string[];
  proof?: any;
}

interface UseSqlQueryOptions extends SWRConfiguration {
  includeProof?: boolean;
  skip?: boolean;
  /**
   * Where to send the query. See `QuerySource` in `@willow/sdk`:
   * - `'validator'`: consensus-verified chain-tip. Fails for VerifyOnly subgroves.
   * - `'indexer'`: historical/analytics via an indexer.
   * - `'auto'` (default): indexer if available, else validator with `fallback: true`.
   */
  source?: QuerySource;
}

/**
 * Hook for executing SQL queries against a subgrove.
 *
 * Uses the underlying SDK's source-routed `sqlQuery`, so the hook's result
 * includes `source` / `fallback` / `indexerDid` telling you where the data
 * came from (useful for trust-model UI).
 *
 * @param subgroveId - The subgrove to query
 * @param sql - SQL SELECT query string (pass null to skip)
 * @param options - Query options including proof, source, and SWR config
 *
 * @example
 * ```tsx
 * const { columns, rows, total, source, fallback, isLoading } = useSqlQuery(
 *   'my-subgrove',
 *   "SELECT id, name, symbol FROM tokens WHERE decimals > 6 ORDER BY name LIMIT 10"
 * );
 * // source: "indexer" | "validator"; fallback: true when auto fell back
 * ```
 */
export function useSqlQuery(
  subgroveId: string | null,
  sql: string | null,
  options?: UseSqlQueryOptions
) {
  const { client } = useWillow();

  // The cast-to-any return type sidesteps a tsup DTS generation bug where
  // the SDK's nested `QueryProof` type (re-exported from two places in
  // @willow/sdk) ends up as `QueryProof$1` in the generated .d.ts and
  // can't be named. Runtime behaviour is unchanged.
  const fetcher = useCallback(async (): Promise<any> => {
    if (!client || !subgroveId || !sql || options?.skip) return null;

    return client.sqlQuery(subgroveId, sql, {
      includeProof: options?.includeProof ?? false,
      source: options?.source ?? 'auto',
    });
  }, [client, subgroveId, sql, options?.includeProof, options?.skip, options?.source]);

  const swrKey = client && subgroveId && sql && !options?.skip
    ? ['sql', subgroveId, sql, options?.includeProof ?? false, options?.source ?? 'auto']
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  // `data` is a RoutedQueryResult<SqlQueryResponse> from the SDK
  const result: SqlQueryHookResult | undefined = data?.result;

  return {
    data: result,
    columns: result?.columns ?? [],
    rows: result?.rows ?? [],
    total: result?.total ?? 0,
    warnings: result?.warnings,
    proof: result?.proof,
    /** Which backend served this query ("validator" | "indexer"). */
    source: data?.source,
    /** True when `auto` routing fell back from indexer to validator. */
    fallback: data?.fallback ?? false,
    /** DID of the indexer that served, when `source === 'indexer'`. */
    indexerDid: data?.indexerDid,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}
