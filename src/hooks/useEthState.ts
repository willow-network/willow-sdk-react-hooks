import { useCallback } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import type {
  EthCallRequestBody,
  StateVerifyMode,
  VerifiedCall,
  VerifiedStateRead,
} from '@willow/sdk';
import { useWillow } from './useWillow';

interface UseEthStateOptions extends SWRConfiguration {
  /** Override the verification mode for this hook only. */
  mode?: StateVerifyMode;
}

/**
 * Verified Ethereum account/storage read at a specific block.
 *
 * Returns `null` while the client isn't ready or `address` is missing.
 * On success, every MPT proof in the response is walked client-side
 * unless `StateVerifyMode.AnchorOnly` / `Disabled` is set.
 */
export function useEthState(
  address: string | null,
  slots: string[],
  blockNumber: number | null,
  options?: UseEthStateOptions
) {
  const { client } = useWillow();

  const fetcher = useCallback(async (): Promise<VerifiedStateRead | null> => {
    if (!client || !address || blockNumber === null) {
      return null;
    }
    const eth = options?.mode ? client.eth.withMode(options.mode) : client.eth;
    return eth.getState(address, slots, blockNumber);
  }, [client, address, blockNumber, slots, options?.mode]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    client && address && blockNumber !== null
      ? ['eth-state', address, slots.join(','), blockNumber]
      : null,
    fetcher,
    { revalidateOnFocus: false, ...options }
  );

  const refetch = useCallback(() => mutate(), [mutate]);

  return { data, error, isLoading, isValidating, refetch };
}

/**
 * Verified `eth_call` at a specific block. The result is the ABI-encoded
 * return data; decode with `viem` / `ethers` ABI machinery on the consumer
 * side.
 */
export function useEthCall(
  tx: EthCallRequestBody['tx'] | null,
  blockNumber: number | null,
  options?: UseEthStateOptions
) {
  const { client } = useWillow();

  const fetcher = useCallback(async (): Promise<VerifiedCall | null> => {
    if (!client || !tx || blockNumber === null) {
      return null;
    }
    const eth = options?.mode ? client.eth.withMode(options.mode) : client.eth;
    return eth.getCall(tx, blockNumber);
  }, [client, tx, blockNumber, options?.mode]);

  const txKey = tx ? JSON.stringify(tx) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    client && txKey && blockNumber !== null ? ['eth-call', txKey, blockNumber] : null,
    fetcher,
    { revalidateOnFocus: false, ...options }
  );

  const refetch = useCallback(() => mutate(), [mutate]);

  return { data, error, isLoading, isValidating, refetch };
}

/**
 * ERC-20 `balanceOf(holder)` at `blockNumber`, verified end-to-end.
 *
 * `balanceSlot` is the storage-mapping slot index for the token (0 for
 * OpenZeppelin-style tokens, 9 for USDC). Check the source if unsure.
 */
export function useErc20Balance(
  token: string | null,
  holder: string | null,
  balanceSlot: number,
  blockNumber: number | null,
  options?: UseEthStateOptions
) {
  const { client } = useWillow();

  const fetcher = useCallback(async (): Promise<bigint | null> => {
    if (!client || !token || !holder || blockNumber === null) {
      return null;
    }
    const eth = options?.mode ? client.eth.withMode(options.mode) : client.eth;
    return eth.erc20Balance(token, holder, balanceSlot, blockNumber);
  }, [client, token, holder, balanceSlot, blockNumber, options?.mode]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    client && token && holder && blockNumber !== null
      ? ['erc20-balance', token, holder, balanceSlot, blockNumber]
      : null,
    fetcher,
    { revalidateOnFocus: false, ...options }
  );

  const refetch = useCallback(() => mutate(), [mutate]);

  return { data, error, isLoading, isValidating, refetch };
}
