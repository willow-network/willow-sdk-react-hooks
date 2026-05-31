import { useState, useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import {
  RegisterDatasetRequest,
  DatasetRegistration,
} from '@willow-network/sdk';
import { useWillow } from './useWillow';

// Types for subgrove (matching Rust SDK)
import type { RetentionWindow } from './useIndexing';

export interface SubgroveRegistration {
  subgrove_id: string;
  name: string;
  schema?: any;
  owner_did: string;
  writers: string[];
  readers: string[];
  retention_window?: RetentionWindow;
  created_at: number;
  updated_at: number;
}

export interface DidPermissions {
  did: string;
  owned_subgroves: string[];
  admin_subgroves: string[];
  writer_subgroves: string[];
  reader_subgroves: string[];
}

/**
 * Hook for listing subgroves
 */
export function useSubgroves(options?: SWRConfiguration) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgroveRegistration[] | null> => {
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
export function useSubgrove(subgroveId: string | null, options?: SWRConfiguration) {
  const { subgroves, error, isLoading, isValidating, refetch } = useSubgroves(options);

  const subgrove = subgroves.find(s => s.subgrove_id === subgroveId) || null;

  return {
    subgrove,
    error,
    isLoading,
    isValidating,
    refetch,
  };
}

/**
 * Hook for fetching DID permissions
 */
export function useDidPermissions(did: string | null, options?: SWRConfiguration) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<DidPermissions | null> => {
    if (!config || !did) return null;

    const response = await fetch(`${config.apiUrl}/did/${encodeURIComponent(did)}/permissions`);
    if (!response.ok) {
      throw new Error('Failed to fetch DID permissions');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'DID not found');
    }

    return data.data;
  }, [config, did]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && did ? ['did', did, 'permissions'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    permissions: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for subgrove registration (mutations)
 */
export function useRegistration() {
  const { client, isAuthenticated } = useWillow();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerDataset = useCallback(async (
    request: RegisterDatasetRequest
  ): Promise<DatasetRegistration> => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsRegistering(true);
    setError(null);

    try {
      const result = await client.registerDataset(request);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsRegistering(false);
    }
  }, [client, isAuthenticated]);

  // Deregister a subgrove and trigger an SWR refresh of the subgroves list.
  // Returns the broadcast tx hash so UIs can show a confirmation link; the
  // server bumps `deployment_epoch` atomically with the dereg so a
  // follow-up register will pick up the new config in running indexers.
  const deregisterSubgrove = useCallback(async (
    subgroveId: string
  ): Promise<string> => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsDeregistering(true);
    setError(null);

    try {
      const result = await client.deregisterSubgrove(subgroveId);
      return result.txHash ?? '';
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsDeregistering(false);
    }
  }, [client, isAuthenticated]);

  return {
    registerDataset,
    deregisterSubgrove,
    isRegistering,
    isDeregistering,
    error,
  };
}