import { useState, useCallback } from 'react';
import {
  RegisterAppRequest,
  RegisterDatasetRequest,
  AppRegistration,
  DatasetRegistration,
} from '@willow/sdk';
import { useWillow } from './useWillow';

/**
 * Hook for app and dataset registration
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