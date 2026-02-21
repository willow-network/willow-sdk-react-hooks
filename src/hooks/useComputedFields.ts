import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ComputedFieldRegistry,
  ComputedFieldSet,
  applyComputedFields,
  applyComputedFieldsToResponse,
  QueryRequest,
  QueryResponse,
  DataRecord,
} from '@willow/sdk';
import { useQuery, usePaginatedQuery } from './useQuery';
import { SWRConfiguration } from 'swr';

/**
 * Hook that provides a computed field registry scoped to the component tree.
 *
 * This allows you to register computed fields that will be applied to query results.
 * The registry persists across renders but is cleaned up when the component unmounts.
 *
 * @example
 * ```tsx
 * import { useComputedFieldRegistry, UNISWAP_V2_PAIR_FIELDS } from '@willow/react-hooks';
 *
 * function MyComponent() {
 *   const { register, unregister, get, has } = useComputedFieldRegistry();
 *
 *   useEffect(() => {
 *     register('uniswap-v2', 'pairs', UNISWAP_V2_PAIR_FIELDS);
 *     return () => unregister('uniswap-v2', 'pairs');
 *   }, [register, unregister]);
 *
 *   // ... use queries that will have computed fields applied
 * }
 * ```
 */
export function useComputedFieldRegistry() {
  // Use a ref to persist the registry across renders
  const registryRef = useRef<ComputedFieldRegistry>(new ComputedFieldRegistry());

  // State to trigger re-renders when registry changes
  const [, setVersion] = useState(0);

  const register = useCallback((appId: string, datasetId: string, fields: ComputedFieldSet) => {
    registryRef.current.register(appId, datasetId, fields);
    setVersion(v => v + 1);
  }, []);

  const unregister = useCallback((appId: string, datasetId: string): boolean => {
    const result = registryRef.current.unregister(appId, datasetId);
    setVersion(v => v + 1);
    return result;
  }, []);

  const get = useCallback((appId: string, datasetId: string): ComputedFieldSet | undefined => {
    return registryRef.current.get(appId, datasetId);
  }, []);

  const has = useCallback((appId: string, datasetId: string): boolean => {
    return registryRef.current.has(appId, datasetId);
  }, []);

  const clear = useCallback(() => {
    registryRef.current.clear();
    setVersion(v => v + 1);
  }, []);

  return {
    registry: registryRef.current,
    register,
    unregister,
    get,
    has,
    clear,
  };
}

interface UseComputedQueryOptions extends SWRConfiguration {
  /**
   * Whether to skip proof verification for performance.
   * Default is false (proofs are verified).
   */
  skipVerification?: boolean;

  /**
   * Computed fields to apply to the query results.
   * If not provided, no computed fields will be applied.
   */
  computedFields?: ComputedFieldSet;
}

/**
 * Hook for querying data with automatic computed field application.
 *
 * This combines the standard useQuery hook with computed field support,
 * automatically applying computed fields to the query results.
 *
 * @param appId - The application ID
 * @param datasetId - The dataset ID
 * @param query - The query request, or null to skip the query
 * @param options - Query options including computed fields
 *
 * @example
 * ```tsx
 * import { useComputedQuery, UNISWAP_V2_PAIR_FIELDS } from '@willow/react-hooks';
 *
 * function PairPrice({ pairId }: { pairId: string }) {
 *   const { documents, isLoading } = useComputedQuery(
 *     'uniswap-v2',
 *     'pairs',
 *     { filters: { id: pairId } },
 *     { computedFields: UNISWAP_V2_PAIR_FIELDS }
 *   );
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   const pair = documents[0];
 *   return (
 *     <div>
 *       <p>Reserve0: {pair.reserve0} (proven)</p>
 *       <p>Reserve1: {pair.reserve1} (proven)</p>
 *       <p>Token0 Price: {pair.token0Price} (computed)</p>
 *       <p>Token1 Price: {pair.token1Price} (computed)</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useComputedQuery(
  appId: string,
  datasetId: string,
  query: QueryRequest | null,
  options?: UseComputedQueryOptions
) {
  const { computedFields, ...queryOptions } = options || {};

  const result = useQuery(appId, datasetId, query, queryOptions);

  // Apply computed fields to the documents
  const computedDocuments = useMemo(() => {
    if (!computedFields || !result.documents.length) {
      return result.documents;
    }

    return result.documents.map(doc => applyComputedFields(doc, computedFields));
  }, [result.documents, computedFields]);

  // Apply computed fields to the full response data
  const computedData = useMemo(() => {
    if (!result.data || !computedFields) {
      return result.data;
    }

    return applyComputedFieldsToResponse(result.data, computedFields);
  }, [result.data, computedFields]);

  return {
    ...result,
    data: computedData,
    documents: computedDocuments,
    // Expose the original uncomputed data for reference
    rawData: result.data,
    rawDocuments: result.documents,
  };
}

/**
 * Hook for paginated queries with automatic computed field application.
 *
 * This combines the standard usePaginatedQuery hook with computed field support.
 *
 * @param appId - The application ID
 * @param datasetId - The dataset ID
 * @param baseQuery - The base query request (without offset/limit)
 * @param pageSize - Number of items per page (default: 20)
 * @param options - Query options including computed fields
 *
 * @example
 * ```tsx
 * import { usePaginatedComputedQuery, GENERIC_AMM_PAIR_FIELDS } from '@willow/react-hooks';
 *
 * function PairsList() {
 *   const {
 *     documents,
 *     isLoading,
 *     page,
 *     nextPage,
 *     previousPage,
 *     hasNextPage,
 *     hasPreviousPage,
 *   } = usePaginatedComputedQuery(
 *     'dex-app',
 *     'pairs',
 *     { sort: { field: 'reserve0', order: 'desc' } },
 *     10,
 *     { computedFields: GENERIC_AMM_PAIR_FIELDS }
 *   );
 *
 *   return (
 *     <div>
 *       {documents.map(pair => (
 *         <div key={pair.id}>
 *           {pair.token0Price} / {pair.token1Price}
 *         </div>
 *       ))}
 *       <button onClick={previousPage} disabled={!hasPreviousPage}>Prev</button>
 *       <button onClick={nextPage} disabled={!hasNextPage}>Next</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePaginatedComputedQuery(
  appId: string,
  datasetId: string,
  baseQuery: Omit<QueryRequest, 'offset' | 'limit'>,
  pageSize: number = 20,
  options?: UseComputedQueryOptions
) {
  const { computedFields, ...queryOptions } = options || {};

  const result = usePaginatedQuery(appId, datasetId, baseQuery, pageSize, queryOptions);

  // Apply computed fields to the documents
  const computedDocuments = useMemo(() => {
    if (!computedFields || !result.documents.length) {
      return result.documents;
    }

    return result.documents.map(doc => applyComputedFields(doc, computedFields));
  }, [result.documents, computedFields]);

  // Apply computed fields to the full response data
  const computedData = useMemo(() => {
    if (!result.data || !computedFields) {
      return result.data;
    }

    return applyComputedFieldsToResponse(result.data, computedFields);
  }, [result.data, computedFields]);

  return {
    ...result,
    data: computedData,
    documents: computedDocuments,
    // Expose the original uncomputed data for reference
    rawData: result.data,
    rawDocuments: result.documents,
  };
}

/**
 * Utility hook to apply computed fields to any data record.
 *
 * This is useful when you have data from other sources that you want
 * to apply computed fields to.
 *
 * @param record - The data record to apply computed fields to
 * @param fields - The computed field definitions to apply
 *
 * @example
 * ```tsx
 * import { useApplyComputedFields, LENDING_PROTOCOL_FIELDS } from '@willow/react-hooks';
 *
 * function MarketStats({ market }: { market: DataRecord }) {
 *   const enhancedMarket = useApplyComputedFields(market, LENDING_PROTOCOL_FIELDS);
 *
 *   return (
 *     <div>
 *       <p>Total Supply: {enhancedMarket.totalSupply}</p>
 *       <p>Total Borrows: {enhancedMarket.totalBorrows}</p>
 *       <p>Utilization Rate: {(enhancedMarket.utilizationRate * 100).toFixed(2)}%</p>
 *       <p>Available Liquidity: {enhancedMarket.availableLiquidity}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useApplyComputedFields(
  record: DataRecord | null | undefined,
  fields: ComputedFieldSet
): DataRecord | null | undefined {
  return useMemo(() => {
    if (!record) {
      return record;
    }

    return applyComputedFields(record, fields);
  }, [record, fields]);
}

/**
 * Utility hook to apply computed fields to a query response.
 *
 * This is useful when you have a query response from other sources
 * that you want to apply computed fields to.
 *
 * @param response - The query response to apply computed fields to
 * @param fields - The computed field definitions to apply
 *
 * @example
 * ```tsx
 * import { useApplyComputedFieldsToResponse, UNISWAP_V2_PAIR_FIELDS } from '@willow/react-hooks';
 *
 * function PairsTable({ response }: { response: QueryResponse }) {
 *   const enhancedResponse = useApplyComputedFieldsToResponse(
 *     response,
 *     UNISWAP_V2_PAIR_FIELDS
 *   );
 *
 *   return (
 *     <table>
 *       {enhancedResponse?.documents.map(pair => (
 *         <tr key={pair.id}>
 *           <td>{pair.token0Price}</td>
 *           <td>{pair.token1Price}</td>
 *         </tr>
 *       ))}
 *     </table>
 *   );
 * }
 * ```
 */
export function useApplyComputedFieldsToResponse(
  response: QueryResponse | null | undefined,
  fields: ComputedFieldSet
): QueryResponse | null | undefined {
  return useMemo(() => {
    if (!response) {
      return response;
    }

    return applyComputedFieldsToResponse(response, fields);
  }, [response, fields]);
}
