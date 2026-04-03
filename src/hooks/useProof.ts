import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

/**
 * Hook for fetching cryptographic proofs
 */
export function useProof(
  datasetId: string,
  key: string | null,
  options?: SWRConfiguration
) {
  const { client } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !key) {
      return null;
    }
    return client.getProof(datasetId, key);
  }, [client, datasetId, key]);

  const { data: proof, error, isLoading, mutate } = useSWR(
    client && key ? ['proof', datasetId, key] : null,
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
