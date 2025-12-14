import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { WillowClient, WillowConfig, Session, DidDocument, ProofVerificationOptions } from '@willow/sdk';

interface WillowContextValue {
  client: WillowClient | null;
  config: WillowConfig | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  initialize: (privateKey?: string, publicKeyId?: string) => Promise<void>;
  login: (privateKey: string, publicKeyId?: string) => Promise<void>;
  logout: () => void;
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
  const [session, setSession] = useState<Session | null>(null);
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

    // Check for existing session
    const existingSession = newClient.auth.getSession();
    if (existingSession) {
      setSession(existingSession);
    }

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
      const newSession = client.auth.getSession();
      setSession(newSession || null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const login = useCallback(async (privateKey: string, publicKeyId?: string) => {
    if (!client || !config.did) {
      throw new Error('Client not initialized or DID not provided');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newSession = await client.auth.login(config.did, privateKey, publicKeyId || '');
      setSession(newSession);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client, config.did]);

  const logout = useCallback(() => {
    if (client) {
      client.auth.clearSession();
    }
    setSession(null);
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
    session,
    isAuthenticated: !!session && session.expires_at > Date.now() / 1000,
    isLoading,
    error,
    initialize,
    login,
    logout,
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