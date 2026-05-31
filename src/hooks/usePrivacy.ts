import { useState, useCallback, useMemo } from 'react';
import useSWR, { mutate as globalMutate, SWRConfiguration } from 'swr';
import { PrivacyOperations } from '@willow-network/sdk';
import type { EncryptedKeyGrant } from '@willow-network/sdk';
import { useWillow } from './useWillow';

// Re-export the canonical EncryptedKeyGrant type from @willow-network/sdk
export type { EncryptedKeyGrant } from '@willow-network/sdk';

/**
 * Parameters for granting a subgrove encryption key to a DID.
 */
export interface GrantKeyParams {
  /** Subgrove to grant access to. */
  subgroveId: string;
  /** The encrypted key grant for the grantee. */
  encryptedKeyGrant: EncryptedKeyGrant;
}

/**
 * Parameters for revoking a subgrove encryption key from a DID.
 */
export interface RevokeKeyParams {
  /** Subgrove to revoke access from. */
  subgroveId: string;
  /** DID to revoke access from. */
  revokeeDid: string;
}

/**
 * Parameters for rotating a subgrove encryption key.
 */
export interface RotateKeyParams {
  /** Subgrove to rotate key for. */
  subgroveId: string;
  /** New key epoch (must be current_epoch + 1). */
  newEpoch: number;
  /** New encrypted key grants for all authorized DIDs. */
  newGrants: EncryptedKeyGrant[];
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Hook for fetching the authenticated user's encryption key grant for a
 * private subgrove.
 *
 * The API requires the caller to be the grantee DID or an owner/admin of the
 * subgrove.
 *
 * 
 * @param subgroveId - Subgrove ID
 * @param options - SWR configuration options
 *
 * @example
 * ```tsx
 * function KeyViewer({ subgroveId }) {
 *   const { keyGrant, isLoading, error } = useKeyGrant(subgroveId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!keyGrant) return <div>No key grant found</div>;
 *
 *   return <div>Key epoch: {keyGrant.key_epoch}</div>;
 * }
 * ```
 */
export function useKeyGrant(

  subgroveId: string | null,
  options?: SWRConfiguration
) {
  const { client, config, isAuthenticated } = useWillow();

  // Get the authenticated user's DID from the client
  const did = client?.auth?.getDid?.() ?? null;

  const fetcher = useCallback(async (): Promise<EncryptedKeyGrant | null> => {
    if (!config || !isAuthenticated || !subgroveId || !did || !client) {
      return null;
    }

    const url = `${config.apiUrl}/key-grants/${encodeURIComponent(subgroveId)}/${encodeURIComponent(did)}`;
    const headers = client.auth.getAuthHeaders('GET', `/key-grants/${subgroveId}/${did}`);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Failed to fetch key grant: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch key grant');
    }

    return data.data;
  }, [config, isAuthenticated, subgroveId, did, client]);

  const swrKey = config && isAuthenticated && subgroveId && did
    ? ['keyGrant', subgroveId, did]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<EncryptedKeyGrant | null>(
    swrKey,
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
    keyGrant: data ?? null,
    error,
    isLoading,
    isValidating,
    refetch,
  };
}

/**
 * Hook for listing all grantee DIDs that have been granted encryption keys
 * for a private subgrove.
 *
 * The API requires the caller to be an owner/admin of the subgrove.
 *
 * 
 * @param subgroveId - Subgrove ID
 * @param options - SWR configuration options
 *
 * @example
 * ```tsx
 * function GranteeList({ subgroveId }) {
 *   const { grantees, isLoading, error } = useKeyGrantees(subgroveId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <ul>
 *       {grantees.map(did => <li key={did}>{did}</li>)}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useKeyGrantees(

  subgroveId: string | null,
  options?: SWRConfiguration
) {
  const { client, config, isAuthenticated } = useWillow();

  const fetcher = useCallback(async (): Promise<string[]> => {
    if (!config || !isAuthenticated || !subgroveId || !client) {
      return [];
    }

    const url = `${config.apiUrl}/key-grants/${encodeURIComponent(subgroveId)}`;
    const headers = client.auth.getAuthHeaders('GET', `/key-grants/${subgroveId}`);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Failed to list key grantees: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to list key grantees');
    }

    return data.data || [];
  }, [config, isAuthenticated, subgroveId, client]);

  const swrKey = config && isAuthenticated && subgroveId
    ? ['keyGrantees', subgroveId]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<string[]>(
    swrKey,
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
    grantees: data ?? [],
    error,
    isLoading,
    isValidating,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Hook that returns a mutation function to grant a subgrove encryption key
 * to a DID.
 *
 * The grant is submitted as an authenticated POST request. The caller must
 * be the subgrove owner or an admin.
 *
 * @example
 * ```tsx
 * function GrantKeyButton({ subgroveId }) {
 *   const { grantKey, isGranting, error } = useGrantKey();
 *
 *   const handleGrant = async () => {
 *     try {
 *       await grantKey({
 *
 *         subgroveId,
 *         encryptedKeyGrant: {
 *           grantee_did: 'did:willow:reader1',
 *           key_epoch: 1,
 *           grantee_public_key_id: 'did:willow:reader1#key-1',
 *           ephemeral_public_key: '...',
 *           encrypted_key: '...',
 *           granted_by: 'did:willow:owner',
 *           granted_at: Math.floor(Date.now() / 1000),
 *         },
 *       });
 *     } catch (err) {
 *       console.error('Grant failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleGrant} disabled={isGranting}>
 *       {isGranting ? 'Granting...' : 'Grant Key'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGrantKey() {
  const { client, config, isAuthenticated } = useWillow();
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const privacy = useMemo(() => {
    if (!client || !config || !isAuthenticated) return null;
    const did = client.auth.getDid();
    const privateKey = client.auth.getPrivateKey();
    const publicKeyId = client.auth.getPublicKeyId();
    if (!did || !privateKey || !publicKeyId) return null;
    return new PrivacyOperations(config.apiUrl, client.auth, privateKey, publicKeyId);
  }, [client, config, isAuthenticated]);

  const grantKey = useCallback(async (params: GrantKeyParams): Promise<void> => {
    if (!privacy) {
      throw new Error('Not authenticated');
    }

    setIsGranting(true);
    setError(null);

    try {
      const { subgroveId, encryptedKeyGrant } = params;
      await privacy.grantSubgroveKey(subgroveId, encryptedKeyGrant);

      // Invalidate related SWR caches so queries refetch
      await globalMutate(['keyGrantees', subgroveId]);
      await globalMutate(['keyGrant', subgroveId, encryptedKeyGrant.grantee_did]);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      throw wrapped;
    } finally {
      setIsGranting(false);
    }
  }, [privacy]);

  return {
    grantKey,
    isGranting,
    error,
  };
}

/**
 * Hook that returns a mutation function to revoke a subgrove encryption key
 * from a DID.
 *
 * The revocation is submitted as an authenticated DELETE request. The caller
 * must be the subgrove owner or an admin.
 *
 * @example
 * ```tsx
 * function RevokeButton({ subgroveId, revokeeDid }) {
 *   const { revokeKey, isRevoking, error } = useRevokeKey();
 *
 *   const handleRevoke = async () => {
 *     try {
 *       await revokeKey({ subgroveId, revokeeDid });
 *     } catch (err) {
 *       console.error('Revoke failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleRevoke} disabled={isRevoking}>
 *       {isRevoking ? 'Revoking...' : 'Revoke Access'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRevokeKey() {
  const { client, config, isAuthenticated } = useWillow();
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const privacy = useMemo(() => {
    if (!client || !config || !isAuthenticated) return null;
    const did = client.auth.getDid();
    const privateKey = client.auth.getPrivateKey();
    const publicKeyId = client.auth.getPublicKeyId();
    if (!did || !privateKey || !publicKeyId) return null;
    return new PrivacyOperations(config.apiUrl, client.auth, privateKey, publicKeyId);
  }, [client, config, isAuthenticated]);

  const revokeKey = useCallback(async (params: RevokeKeyParams): Promise<void> => {
    if (!privacy) {
      throw new Error('Not authenticated');
    }

    setIsRevoking(true);
    setError(null);

    try {
      const { subgroveId, revokeeDid } = params;
      await privacy.revokeSubgroveKey(subgroveId, revokeeDid);

      // Invalidate related SWR caches
      await globalMutate(['keyGrantees', subgroveId]);
      await globalMutate(['keyGrant', subgroveId, revokeeDid]);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      throw wrapped;
    } finally {
      setIsRevoking(false);
    }
  }, [privacy]);

  return {
    revokeKey,
    isRevoking,
    error,
  };
}

/**
 * Hook that returns a mutation function to rotate the encryption key for a
 * private subgrove.
 *
 * Key rotation:
 * 1. Increments the key epoch
 * 2. Deletes all existing key grants
 * 3. Stores new grants (re-wrapped with the new symmetric key) for all
 *    DIDs that should retain access
 *
 * The caller must be the subgrove owner.
 *
 * @example
 * ```tsx
 * function RotateButton({ subgroveId }) {
 *   const { rotateKey, isRotating, error } = useRotateKey();
 *
 *   const handleRotate = async () => {
 *     try {
 *       await rotateKey({
 *
 *         subgroveId,
 *         newEpoch: 2,
 *         newGrants: [
 *           // Re-wrapped grants for each authorized DID
 *         ],
 *       });
 *     } catch (err) {
 *       console.error('Rotation failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleRotate} disabled={isRotating}>
 *       {isRotating ? 'Rotating...' : 'Rotate Key'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRotateKey() {
  const { client, config, isAuthenticated } = useWillow();
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const privacy = useMemo(() => {
    if (!client || !config || !isAuthenticated) return null;
    const did = client.auth.getDid();
    const privateKey = client.auth.getPrivateKey();
    const publicKeyId = client.auth.getPublicKeyId();
    if (!did || !privateKey || !publicKeyId) return null;
    return new PrivacyOperations(config.apiUrl, client.auth, privateKey, publicKeyId);
  }, [client, config, isAuthenticated]);

  const rotateKey = useCallback(async (params: RotateKeyParams): Promise<void> => {
    if (!privacy) {
      throw new Error('Not authenticated');
    }

    setIsRotating(true);
    setError(null);

    try {
      const { subgroveId, newEpoch, newGrants } = params;
      await privacy.rotateSubgroveKey(subgroveId, newEpoch, newGrants);

      // Invalidate all key-grant caches for this subgrove
      await globalMutate(['keyGrantees', subgroveId]);
      // Invalidate individual grant caches for all DIDs in the new grants
      await Promise.all(
        newGrants.map((grant) =>
          globalMutate(['keyGrant', subgroveId, grant.grantee_did])
        )
      );
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      throw wrapped;
    } finally {
      setIsRotating(false);
    }
  }, [privacy]);

  return {
    rotateKey,
    isRotating,
    error,
  };
}
