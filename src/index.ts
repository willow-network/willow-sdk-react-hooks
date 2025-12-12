// Providers
export { WillowProvider } from './providers/WillowProvider';
export type { WillowProviderProps } from './providers/WillowProvider';

// Core hooks
export { useWillow } from './hooks/useWillow';
export { useAuth } from './hooks/useAuth';
export { useData, useDataMutation, useBatchData } from './hooks/useData';
export { useCollection } from './hooks/useCollection';
export { useRegistration } from './hooks/useRegistration';
export { useProof } from './hooks/useProof';
export { useQuery, usePaginatedQuery } from './hooks/useQuery';
export { useProofVerification, useProofConfig } from './hooks/useProofVerification';

// Re-export types from SDK
export type {
  WillowConfig,
  DidDocument,
  Session,
  AppRegistration,
  DatasetRegistration,
  RegisterAppRequest,
  RegisterDatasetRequest,
  DataRecord,
  SchemaDefinition,
  QueryRequest,
  QueryResponse,
  ProofVerificationOptions,
  ProofVerificationResult,
} from '@willow/sdk';