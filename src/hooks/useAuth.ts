import { useState, useCallback } from 'react';
import { generateWallet, createDidFromWallet, DidDocument } from '@willow/sdk';
import { useWillow } from './useWillow';

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const { isAuthenticated, hasIdentity, setIdentity, clearIdentity, registerDid } = useWillow();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndRegister = useCallback(async (): Promise<{
    did: string;
    privateKey: string;
    publicKey: string;
    didDocument: DidDocument;
  }> => {
    setIsGenerating(true);
    try {
      // Generate wallet
      const wallet = generateWallet();
      const didDocument = createDidFromWallet(wallet);

      // Register DID
      await registerDid(didDocument);

      // Set identity for per-request signing
      setIdentity(didDocument.id, wallet.privateKey, didDocument.publicKeys[0].id);

      return {
        did: didDocument.id,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        didDocument,
      };
    } finally {
      setIsGenerating(false);
    }
  }, [registerDid, setIdentity]);

  return {
    isAuthenticated,
    hasIdentity,
    setIdentity,
    clearIdentity,
    generateAndRegister,
    isGenerating,
  };
}