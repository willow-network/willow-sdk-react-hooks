import { useCallback } from 'react';
import useSWR, { mutate, SWRConfiguration } from 'swr';
import { DataRecord } from '@willow/sdk';
import { useWillow } from './useWillow';

interface UseDataOptions extends SWRConfiguration {
  suspense?: boolean;
  /**
   * Whether to skip proof verification for performance.
   * Default is false (proofs are verified).
   */
  skipVerification?: boolean;
}

/**
 * Hook for fetching data with caching
 */
export function useData(
  datasetId: string,
  key: string | null,
  options?: UseDataOptions
) {
  const { client, isAuthenticated } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !isAuthenticated || !key) {
      return null;
    }

    // Use unverified method if skipVerification is true
    if (options?.skipVerification) {
      return client.data.getDataUnverified(datasetId, key);
    }

    // Default to verified data fetching
    return client.data.getData(datasetId, key);
  }, [client, isAuthenticated, datasetId, key, options?.skipVerification]);

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR(
    client && isAuthenticated && key ? ['data', datasetId, key] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  const refetch = useCallback(() => {
    return swrMutate();
  }, [swrMutate]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    refetch,
  };
}

/**
 * Hook for data mutations (create, update, delete)
 */
export function useDataMutation(datasetId: string) {
  const { client, isAuthenticated } = useWillow();

  const store = useCallback(async (key: string, value: any) => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    // Store data using batch store API
    await client.data.storeData(datasetId, { [key]: value });

    // Invalidate cache for this key
    await mutate(['data', datasetId, key]);

    return value;
  }, [client, isAuthenticated, datasetId]);

  const update = useCallback(async (key: string, value: any) => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    await client.data.updateData(datasetId, key, value);

    // Update cache
    await mutate(['data', datasetId, key], value, false);

    return value;
  }, [client, isAuthenticated, datasetId]);

  const remove = useCallback(async (key: string) => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    await client.data.deleteData(datasetId, key);

    // Remove from cache
    await mutate(['data', datasetId, key], undefined, false);
  }, [client, isAuthenticated, datasetId]);

  return {
    store,
    update,
    remove,
  };
}

/**
 * Hook for batch operations
 */
export function useBatchData(datasetId: string) {
  const { client, isAuthenticated } = useWillow();

  const batchStore = useCallback(async (records: Array<{ key: string; value: any }>) => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    await client.data.batchStore(datasetId, records);

    // Invalidate cache for all keys
    await Promise.all(
      records.map(({ key }) => mutate(['data', datasetId, key]))
    );
  }, [client, isAuthenticated, datasetId]);

  const getMultiple = useCallback(async (keys: string[]): Promise<Record<string, DataRecord>> => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    return client.data.getMultiple(datasetId, keys);
  }, [client, isAuthenticated, datasetId]);

  return {
    batchStore,
    getMultiple,
  };
}