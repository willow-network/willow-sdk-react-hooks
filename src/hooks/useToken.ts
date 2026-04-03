import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

// Token types (matching Rust SDK)
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  genesis_supply: string;
  minted_supply: string;
  max_supply: string;
  circulating_supply: string;
}

export interface BalanceInfo {
  did?: string;
  balance: string;
  available: string;
  staked: string;
  locked: string;
}

export interface FeeSchedule {
  did_registration: string;
  subgrove_registration: string;
  base_tx_cost: string;
  cost_per_byte: string;
  query_fee: string;
  transfer_fee_percentage: number;
  max_tx_size_bytes: number;
  max_data_payload_bytes: number;
}

interface UseTokenInfoOptions extends SWRConfiguration {}

/**
 * Hook for fetching token information
 */
export function useTokenInfo(options?: UseTokenInfoOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<TokenInfo | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/token/info`);
    if (!response.ok) {
      throw new Error('Failed to fetch token info');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'No token info available');
    }

    return data.data;
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['token', 'info'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    tokenInfo: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

interface UseBalanceOptions extends SWRConfiguration {}

/**
 * Hook for fetching a DID's balance
 */
export function useBalance(did: string | null, options?: UseBalanceOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<BalanceInfo | null> => {
    if (!config || !did) return null;

    const response = await fetch(`${config.apiUrl}/token/balance/${encodeURIComponent(did)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Balance not found');
    }

    return data.data;
  }, [config, did]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && did ? ['token', 'balance', did] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    balance: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching a subgrove's balance
 */
export function useSubgroveBalance(subgroveId: string | null, options?: UseBalanceOptions) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<BalanceInfo | null> => {
    if (!config || !subgroveId) return null;

    const response = await fetch(`${config.apiUrl}/token/subgrove/balance/${encodeURIComponent(subgroveId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch subgrove balance');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Subgrove balance not found');
    }

    return data.data;
  }, [config, subgroveId]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config && subgroveId ? ['token', 'subgrove', 'balance', subgroveId] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    balance: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Hook for fetching the fee schedule
 */
export function useFeeSchedule(options?: SWRConfiguration) {
  const { config } = useWillow();

  const fetcher = useCallback(async (): Promise<FeeSchedule | null> => {
    if (!config) return null;

    const response = await fetch(`${config.apiUrl}/fees/schedule`);
    if (!response.ok) {
      throw new Error('Failed to fetch fee schedule');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'No fee schedule available');
    }

    return data.data;
  }, [config]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    config ? ['fees', 'schedule'] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...options,
    }
  );

  return {
    feeSchedule: data,
    error,
    isLoading,
    isValidating,
    refetch: mutate,
  };
}

/**
 * Convenience hook that combines token info, user balance, and fee schedule
 */
export function useToken(did?: string | null) {
  const tokenInfo = useTokenInfo();
  const balance = useBalance(did || null);
  const feeSchedule = useFeeSchedule();

  return {
    tokenInfo: tokenInfo.tokenInfo,
    balance: balance.balance,
    feeSchedule: feeSchedule.feeSchedule,
    isLoading: tokenInfo.isLoading || balance.isLoading || feeSchedule.isLoading,
    error: tokenInfo.error || balance.error || feeSchedule.error,
    refetch: () => {
      tokenInfo.refetch();
      balance.refetch();
      feeSchedule.refetch();
    },
  };
}
