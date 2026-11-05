import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { WillowClient, WillowConfig, DidDocument, ProofVerificationOptions } from '@willow-network/sdk';
import type { BroadcastResult, SignatureAlgorithm } from '@willow-network/sdk';

interface WillowContextValue {
  client: WillowClient | null;
  config: WillowConfig | null;
  isAuthenticated: boolean;
  hasIdentity: boolean;
  isLoading: boolean;
  error: Error | null;
  /**
   * Set the identity from the config's DID. Without `publicKeyId`, the key id
   * and algorithm come from the DID's on-chain document.
   */
  initialize: (
    privateKey?: string,
    publicKeyId?: string,
    algorithm?: SignatureAlgorithm,
  ) => Promise<void>;
  /**
   * Set the identity requests and transactions are signed as. Pass
   * `algorithm` for a secp256k1 key not in the `0x`-prefixed form; without
   * it the SDK infers the algorithm from the DID and the key's form.
   */
  setIdentity: (
    did: string,
    privateKey: string,
    publicKeyId: string,
    algorithm?: SignatureAlgorithm,
  ) => void;
  clearIdentity: () => void;
  /**
   * Send a RegisterDid transaction for `didDocument`. The identity must be the
   * DID being registered (set it first); the SDK signs with the algorithm of
   * the document's key and throws a TransactionSubmitError if it isn't
   * accepted.
   */
  registerDid: (didDocument: DidDocument) => Promise<BroadcastResult>;
}

const WillowContext = createContext<WillowContextValue | undefined>(undefined);

export interface WillowProviderProps {
  config: WillowConfig;
  children: ReactNode;
  autoConnect?: boolean;
  proofVerificationOptions?: ProofVerificationOptions;
}

export function WillowProvider({ config, children, autoConnect = false, proofVerificationOptions }: WillowProviderProps) {
  const [client, setClient] = useState<WillowClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Bumped whenever the identity changes, so consumers re-render with it.
  const [, setIdentityVersion] = useState(0);

  // Initialize client on mount
  useEffect(() => {
    // Add proof verification options to config if provided
    const clientConfig = proofVerificationOptions
      ? { ...config, proofVerificationOptions }
      : config;

    const newClient = new WillowClient(clientConfig);
    setClient(newClient);

    // Auto-connect if configured
    if (autoConnect && config.privateKey && config.did) {
      initialize();
    }
  }, [config.apiUrl, config.did, proofVerificationOptions]); // Only recreate if these change

  const initialize = useCallback(async (
    privateKey?: string,
    publicKeyId?: string,
    algorithm?: SignatureAlgorithm,
  ) => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      await client.init(privateKey, publicKeyId, algorithm);
      setIdentityVersion((v) => v + 1);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const setIdentity = useCallback((
    did: string,
    privateKey: string,
    publicKeyId: string,
    algorithm?: SignatureAlgorithm,
  ) => {
    if (!client) {
      throw new Error('Client not initialized');
    }
    if (algorithm) {
      client.auth.setIdentity(did, privateKey, publicKeyId, algorithm);
    } else {
      client.auth.setIdentity(did, privateKey, publicKeyId);
    }
    setIdentityVersion((v) => v + 1);
  }, [client]);

  const clearIdentity = useCallback(() => {
    if (client) {
      client.auth.setIdentity('', '', '');
    }
    setIdentityVersion((v) => v + 1);
  }, [client]);

  const registerDid = useCallback(async (didDocument: DidDocument): Promise<BroadcastResult> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      return await client.registerDid(didDocument);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const value: WillowContextValue = {
    client,
    config,
    isAuthenticated: !!client?.auth.hasIdentity(),
    hasIdentity: !!client?.auth.hasIdentity(),
    isLoading,
    error,
    initialize,
    setIdentity,
    clearIdentity,
    registerDid,
  };

  return <WillowContext.Provider value={value}>{children}</WillowContext.Provider>;
}

export function useWillowContext() {
  const context = useContext(WillowContext);
  if (!context) {
    throw new Error('useWillowContext must be used within a WillowProvider');
  }
  return context;
}