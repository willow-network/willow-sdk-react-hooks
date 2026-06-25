import { useCallback, useState } from 'react';
import {
  verifyQueryProof as sdkVerifyQueryProof,
  verifyItemProof as sdkVerifyItemProof,
  extractRootHashFromProof as sdkExtractRootHash,
  ProofVerificationOptions,
  GroveDBProofVerifier,
  ProofVerificationResult
} from '@willow-network/sdk';
import { useWillow } from './useWillow';

/**
 * Hook for proof verification operations
 * 
 * This hook provides methods for verifying GroveDB proofs in React applications.
 * It supports both automatic verification (integrated with data fetching) and
 * manual verification for advanced use cases.
 */
export function useProofVerification() {
  const { config } = useWillow();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<Error | null>(null);

  /**
   * Verify a query proof
   */
  const verifyQueryProof = useCallback(async (
    proofHex: string,
    documents: any[]
  ): Promise<string> => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const rootHash = await sdkVerifyQueryProof(proofHex, documents);
      return rootHash;
    } catch (error) {
      setVerificationError(error as Error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  /**
   * Verify a single item proof
   */
  const verifyItemProof = useCallback(async (
    proofHex: string,
    key: string,
    value: any,
    path?: string[]
  ): Promise<string> => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const rootHash = await sdkVerifyItemProof(proofHex, key, value, path);
      return rootHash;
    } catch (error) {
      setVerificationError(error as Error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  /**
   * Extract root hash from proof without full verification
   */
  const extractRootHash = useCallback(async (proofHex: string): Promise<string> => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const rootHash = await sdkExtractRootHash(proofHex);
      return rootHash;
    } catch (error) {
      setVerificationError(error as Error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  /**
   * Get the verified root hash from consensus
   */
  const getVerifiedRootHash = useCallback(async (): Promise<string> => {
    if (!config) {
      throw new Error('Client not initialized');
    }

    const response = await fetch(`${config.apiUrl}/state/root-hash/verified`);
    if (!response.ok) {
      throw new Error('Failed to fetch verified root hash');
    }

    const data = await response.json();
    if (!data.success || !data.data?.root_hash) {
      throw new Error('No root hash in response');
    }

    return data.data.root_hash;
  }, [config]);

  /**
   * Compare a proof's root hash with consensus
   */
  const verifyAgainstConsensus = useCallback(async (
    proofHex: string,
    documents: any[]
  ): Promise<boolean> => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const [computedRootHash, consensusRootHash] = await Promise.all([
        verifyQueryProof(proofHex, documents),
        getVerifiedRootHash()
      ]);

      return computedRootHash.toLowerCase() === consensusRootHash.toLowerCase();
    } catch (error) {
      setVerificationError(error as Error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [verifyQueryProof, getVerifiedRootHash]);

  /**
   * Create a custom verifier with specific options
   */
  const createVerifier = useCallback((options: ProofVerificationOptions) => {
    return new GroveDBProofVerifier(options);
  }, []);

  return {
    verifyQueryProof,
    verifyItemProof,
    extractRootHash,
    getVerifiedRootHash,
    verifyAgainstConsensus,
    createVerifier,
    isVerifying,
    verificationError
  };
}

/**
 * Hook for automatic proof verification configuration
 * 
 * This hook allows you to dynamically configure proof verification
 * options for the current client.
 */
export function useProofConfig() {
  const { config } = useWillow();
  const [currentOptions, setCurrentOptions] = useState<ProofVerificationOptions | null>(null);

  /**
   * Update proof verification options
   */
  const updateProofOptions = useCallback((options: ProofVerificationOptions) => {
    if (!config) {
      throw new Error('Client not initialized');
    }

    // Note: The TypeScript SDK's configureProofVerification is global,
    // so this will affect all proof verifications
    const { configureProofVerification } = require('@willow-network/sdk');
    configureProofVerification(options);
    setCurrentOptions(options);
  }, [config]);

  /**
   * Set expected root hash for verification
   */
  const setExpectedRootHash = useCallback((rootHash: string) => {
    updateProofOptions({
      expectedRootHash: rootHash
    });
  }, [updateProofOptions]);

  /**
   * Reset to default verification
   */
  const resetToDefault = useCallback(() => {
    updateProofOptions({});
    setCurrentOptions(null);
  }, [updateProofOptions]);

  return {
    currentOptions,
    updateProofOptions,
    setExpectedRootHash,
    resetToDefault
  };
}