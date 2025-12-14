import { useState, useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import {
  RegisterAppRequest,
  RegisterDatasetRequest,
  AppRegistration,
  DatasetRegistration,
} from '@willow/sdk';
import { useWillow } from './useWillow';

// Types for subgrove (matching Rust SDK)
export interface SubgroveRegistration {
  subgrove_id: string;
  app_id: string;
  name: string;
  schema?: any;
  owner_did: string;
  writers: string[];
  readers: string[];
  created_at: number;
  updated_at: number;
}

export interface DidPermissions {
  did: string;
  owned_apps: string[];
  admin_apps: string[];
  writer_subgroves: string[];
  reader_subgroves: string[];
}

/**
 * Hook for listing all apps
 */
export function useApps(options?: SWRConfiguration) {
  const { config, isAuthenticated } = useWillow();

  const fetcher = useCallback(async (): Promise<AppRegistration[] | null> => {
    if (!config) return null;

    const url = new URL(`${config.apiUrl}/apps`);
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error('Failed to fetch apps');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch apps');
    }

    return data.data || [];
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['apps'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    apps: data || [],
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a specific app
 */
export function useApp(appId: string | null, options?: SWRConfiguration) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<AppRegistration | null> => {
    if (!config || !appId) return null;

    const response = await fetch(`${config.apiUrl}/apps/${encodeURIComponent(appId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch app');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'App not found');
    }

    return data.data;
  }, [config, appId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && appId ? ['apps', appId] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    app: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for listing subgroves for an app
 */
export function useSubgroves(appId: string | null, options?: SWRConfiguration) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<SubgroveRegistration[] | null> => {
    if (!config || !appId) return null;

    const response = await fetch(`${config.apiUrl}/apps/${encodeURIComponent(appId)}/subgroves`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgroves');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subgroves');
    }

    return data.data || [];
  }, [config, appId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && appId ? ['apps', appId, 'subgroves'] : null,
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
export function useSubgrove(appId: string | null, subgroveId: string | null, options?: SWRConfiguration) {
  const { subgroves, error, isLoading, isValidating, refetch } = useSubgroves(appId, options);

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
 * Hook for app and dataset registration (mutations)
 */
export function useRegistration() {
  const { client, isAuthenticated } = useWillow();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerApp = useCallback(async (
    request: RegisterAppRequest
  ): Promise<AppRegistration> => {
    if (!client || !isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsRegistering(true);
    setError(null);

    try {
      const result = await client.registerApp(request);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsRegistering(false);
    }
  }, [client, isAuthenticated]);

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

  return {
    registerApp,
    registerDataset,
    isRegistering,
    error,
  };
}