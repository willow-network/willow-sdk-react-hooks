import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { WillowClient, WillowConfig, DidDocument, ProofVerificationOptions } from '@willow-network/sdk';

interface WillowContextValue {
  client: WillowClient | null;
  config: WillowConfig | null;
  isAuthenticated: boolean;
  hasIdentity: boolean;
  isLoading: boolean;
  error: Error | null;
  initialize: (privateKey?: string, publicKeyId?: string) => Promise<void>;
  setIdentity: (did: string, privateKey: string, publicKeyId: string) => void;
  clearIdentity: () => void;
  registerDid: (didDocument: DidDocument) => Promise<DidDocument>;
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

  const initialize = useCallback(async (privateKey?: string, publicKeyId?: string) => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      await client.init(privateKey, publicKeyId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const setIdentity = useCallback((did: string, privateKey: string, publicKeyId: string) => {
    if (!client) {
      throw new Error('Client not initialized');
    }
    client.auth.setIdentity(did, privateKey, publicKeyId);
  }, [client]);

  const clearIdentity = useCallback(() => {
    if (client) {
      client.auth.setIdentity('', '', '');
    }
  }, [client]);

  const registerDid = useCallback(async (didDocument: DidDocument): Promise<DidDocument> => {
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