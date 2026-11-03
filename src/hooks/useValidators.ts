import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

/**
 * A validator as the API's `/validators` and `/validators/:did` return it.
 *
 * Stakes are u128 base units sent as JSON numbers. Above 2^53 they lose
 * precision when parsed, so treat them as display values.
 */
export interface ValidatorInfo {
  did: string;
  total_stake: number;
  self_stake: number;
  active: boolean;
  jailed: boolean;
  /** Unix seconds when the jail period ends, if jailed. */
  jail_end_time: number | null;
  consensus_pubkey: string | null;
}

export type ValidatorStatus = 'active' | 'inactive' | 'jailed' | 'unbonding';

export interface ValidatorSet {
  validators: ValidatorInfo[];
  /** Sum of `total_stake` over the set (approximate, like the stakes). */
  total_stake: number;
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

    // The API lists the active set at `/validators`; there is no set route.
    const response = await fetch(`${config.apiUrl}/validators`);
    if (!response.ok) {
      throw new Error('Failed to fetch validator set');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch validator set');
    }
    const validators: ValidatorInfo[] = data.data || [];

    return {
      validators,
      total_stake: validators.reduce((sum, v) => sum + v.total_stake, 0),
    };
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
    totalStake: data?.total_stake || 0,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}
