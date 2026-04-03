import { useMemo } from 'react';
import { useData, useDataMutation, useBatchData } from './useData';
import { useWillow } from './useWillow';

/**
 * Hook for working with a specific collection (app + dataset)
 */
export function useCollection(datasetId: string) {
  const { client } = useWillow();
  const { store, update, remove } = useDataMutation(datasetId);
  const { batchStore, getMultiple } = useBatchData(datasetId);

  // Note: The TypeScript SDK doesn't have a collection method,
  // so we return a helper object instead
  const collection = useMemo(() => {
    if (!client) return null;
    return {
      datasetId,
      client
    };
  }, [client, datasetId]);

  return {
    collection,
    store,
    update,
    remove,
    batchStore,
    getMultiple,
    // Export useData for individual key fetching
    useItem: (key: string | null) => useData(datasetId, key),
  };
}