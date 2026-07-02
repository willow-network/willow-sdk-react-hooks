import { useState, useCallback } from 'react';
import { generateWallet, createDidFromWallet, DidDocument } from '@willow-network/sdk';
import { useWillow } from './useWillow';

/**
 * A freshly derived Willow identity: the self-certifying DID plus the material
 * needed to fund, register, and later sign as it.
 *
 * The DID is **derived from the public key** (not chosen) — see {@link useAuth}.
 */
export interface GeneratedIdentity {
  /** Self-certifying DID, derived from the public key (`did:willow:z…`). */
  did: string;
  /** Verification-method id, by convention `${did}#key-1`. */
  publicKeyId: string;
  /** Hex-encoded private key. Persist securely to reuse this DID later. */
  privateKey: string;
  /** Hex-encoded public key the DID is derived from. */
  publicKey: string;
  /** Full DID document to pass to `registerDid`. */
  didDocument: DidDocument;
}

/**
 * Hook for authentication operations.
 *
 * Willow DIDs are **self-certifying**: the id is derived from the public key
 * (`did:willow:z…`) by the SDK's `createDidFromWallet`, it is not chosen. The
 * chain's `RegisterDid` check rejects any id that is not exactly this
 * derivation, so there is no chosen-id path.
 *
 * Because the id is bound to the key, a brand-new DID must be **funded before
 * it can be registered** — the on-chain registration fee is paid from the
 * derived id's own balance. The onboarding order is therefore:
 *
 *   1. `generateIdentity()` — derive the DID + keypair (no on-chain call).
 *   2. fund `did` — transfer ≥ the registration fee to the derived id.
 *   3. `registerDid(didDocument)` — register (fee debited from the funded id).
 *   4. `setIdentity(...)` — activate the identity for per-request signing.
 *
 * `generateAndRegister()` is a convenience that runs steps 1, 3 and 4 in a
 * single call; it only succeeds if the derived DID has already been funded
 * (step 2). For the two-step bootstrap, call `generateIdentity()` first, fund
 * the returned `did`, then `registerDid(didDocument)` + `setIdentity(...)`.
 */
export function useAuth() {
  const { isAuthenticated, hasIdentity, setIdentity, clearIdentity, registerDid } = useWillow();
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Derive a fresh keypair and its self-certifying DID **without** touching the
   * chain. Use this first so the returned `did` can be funded (step 2) before
   * calling `registerDid(didDocument)`.
   */
  const generateIdentity = useCallback((): GeneratedIdentity => {
    const wallet = generateWallet();
    const didDocument = createDidFromWallet(wallet);
    return {
      did: didDocument.id,
      publicKeyId: didDocument.publicKeys[0].id,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      didDocument,
    };
  }, []);

  const generateAndRegister = useCallback(async (): Promise<{
    did: string;
    privateKey: string;
    publicKey: string;
    didDocument: DidDocument;
  }> => {
    setIsGenerating(true);
    try {
      // Step 1: derive the self-certifying DID (no on-chain call).
      const identity = generateIdentity();

      // Step 3: register. Requires the derived DID (step 2) to be funded
      // already — the registration fee is paid from the derived id's balance.
      await registerDid(identity.didDocument);

      // Step 4: activate the identity for per-request signing.
      setIdentity(identity.did, identity.privateKey, identity.publicKeyId);

      return {
        did: identity.did,
        privateKey: identity.privateKey,
        publicKey: identity.publicKey,
        didDocument: identity.didDocument,
      };
    } finally {
      setIsGenerating(false);
    }
  }, [generateIdentity, registerDid, setIdentity]);

  return {
    isAuthenticated,
    hasIdentity,
    setIdentity,
    clearIdentity,
    generateIdentity,
    generateAndRegister,
    isGenerating,
  };
}
