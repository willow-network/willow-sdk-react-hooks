import { useState, useCallback } from 'react';
import { generateWallet, createDidFromWallet, DidDocument } from '@willow/sdk';
import { useWillow } from './useWillow';

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const { isAuthenticated, session, login, logout, registerDid } = useWillow();
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

      // Login
      await login(wallet.privateKey, didDocument.publicKeys[0].id);

      return {
        did: didDocument.id,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        didDocument,
      };
    } finally {
      setIsGenerating(false);
    }
  }, [registerDid, login]);

  return {
    isAuthenticated,
    session,
    login,
    logout,
    generateAndRegister,
    isGenerating,
  };
}