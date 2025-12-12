import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

/**
 * Hook for fetching cryptographic proofs
 */
export function useProof(
  appId: string,
  datasetId: string,
  key: string | null,
  options?: SWRConfiguration
) {
  const { client } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !key) {
      return null;
    }
    return client.getProof(appId, datasetId, key);
  }, [client, appId, datasetId, key]);

  const { data: proof, error, isLoading, mutate } = useSWR(
    client && key ? ['proof', appId, datasetId, key] : null,
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
    proof,
    error,
    isLoading,
    refetch,
  };
}