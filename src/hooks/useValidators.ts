import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

// Validator types (matching Rust SDK)
export interface ValidatorInfo {
  address: string;
  pub_key: string;
  voting_power: number;
  proposer_priority: number;
  moniker?: string;
  status: ValidatorStatus;
}

export type ValidatorStatus = 'active' | 'inactive' | 'jailed' | 'unbonding';

export interface ValidatorSet {
  validators: ValidatorInfo[];
  total_voting_power: number;
  block_height: number;
}

interface UseValidatorsOptions extends SWRConfiguration {}

/**
 * Hook for fetching the current validator set
 */
export function useValidators(options?: UseValidatorsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<ValidatorInfo[] | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/validators`);
    if (!response.ok) {
      throw new Error('Failed to fetch validators');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch validators');
    }

    return data.data || [];
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['validators'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    validators: data || [],
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a specific validator by DID
 */
export function useValidator(did: string | null, options?: UseValidatorsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<ValidatorInfo | null> => {
    if (!config || !did) return null;

    const response = await fetch(`${config.apiUrl}/validators/${encodeURIComponent(did)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch validator');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Validator not found');
    }

    return data.data;
  }, [config, did]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && did ? ['validators', did] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    validator: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching the validator set with additional metadata
 */
export function useValidatorSet(options?: UseValidatorsOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<ValidatorSet | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/validators/set`);
    if (!response.ok) {
      // Fall back to basic validators endpoint
      const fallbackResponse = await fetch(`${config.apiUrl}/validators`);
      if (!fallbackResponse.ok) {
        throw new Error('Failed to fetch validator set');
      }

      const fallbackData = await fallbackResponse.json();
      const validators = fallbackData.data || [];

      return {
        validators,
        total_voting_power: validators.reduce((sum: number, v: ValidatorInfo) => sum + v.voting_power, 0),
        block_height: 0,
      };
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch validator set');
    }

    return data.data;
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['validators', 'set'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    validatorSet: data,
    validators: data?.validators || [],
    totalVotingPower: data?.total_voting_power || 0,
    blockHeight: data?.block_height || 0,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}
