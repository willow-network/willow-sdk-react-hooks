// Providers
export { WillowProvider } from './providers/WillowProvider';
export type { WillowProviderProps } from './providers/WillowProvider';

// Core hooks
export { useWillow } from './hooks/useWillow';
export { useAuth } from './hooks/useAuth';
export { useData, useDataMutation, useBatchData } from './hooks/useData';
export { useCollection } from './hooks/useCollection';
export {
  useRegistration,
  useSubgroves,
  useSubgrove,
  useDidPermissions,
} from './hooks/useRegistration';
export type {
  SubgroveRegistration,
  DidPermissions,
} from './hooks/useRegistration';
export { useProof } from './hooks/useProof';
export { useQuery, usePaginatedQuery } from './hooks/useQuery';
export { useProofVerification, useProofConfig } from './hooks/useProofVerification';
export {
  useHistoricalQuery,
  useCheckpointStateRoot,
  useHistoricalQueryMutation,
} from './hooks/useHistoricalQuery';

// Token hooks
export {
  useToken,
  useTokenInfo,
  useBalance,
  useSubgroveBalance,
  useFeeSchedule,
} from './hooks/useToken';
export type {
  TokenInfo,
  BalanceInfo,
  FeeSchedule,
} from './hooks/useToken';

// Validator hooks
export {
  useValidators,
  useValidator,
  useValidatorSet,
} from './hooks/useValidators';
export type {
  ValidatorInfo,
  ValidatorStatus,
  ValidatorSet,
} from './hooks/useValidators';

// SQL hooks
export { useSqlQuery } from './hooks/useSqlQuery';
export type { SqlQueryResponse } from './hooks/useSqlQuery';

// Indexing/GraphQL hooks
export {
  useSubgroves,
  useSubgrove,
  useSubgroveStatus,
  useIndexers,
  useIndexer,
  useVerificationStats,
  useGraphQL,
  useGraphQLMutation,
} from './hooks/useIndexing';
export type {
  RetentionWindow,
  SubgroveInfo,
  SubgroveStatus,
  SubgroveIndexingStatus,
  ChainIndexingStatus,
  IndexerInfo,
  IndexerStatus,
  GraphQLResponse,
  GraphQLError,
  VerificationStats,
} from './hooks/useIndexing';

// Re-export types from SDK
export type {
  WillowConfig,
  DidDocument,
  DatasetRegistration,
  RegisterDatasetRequest,
  DataRecord,
  SchemaDefinition,
  QueryRequest,
  QueryResponse,
  ProofVerificationOptions,
  ProofVerificationResult,
  HistoricalQueryRequest,
  HistoricalQueryResponse,
  CheckpointInfo,
} from '@willow/sdk';

// Re-export DEVNET_TEST_ACCOUNT from SDK
export { DEVNET_TEST_ACCOUNT } from '@willow/sdk';

// ERC-8004 agent identity hooks
export { useErc8004Agent, useErc8004Reputation, useErc8004Validation, useErc8004AgentDiscovery } from './hooks/useErc8004Agent';
export type {
  AgentRegistrationJson as Erc8004AgentRegistration,
  AgentReputationSummary,
  Erc8004Registration,
  Erc8004AgentListItem,
  Erc8004AgentListResponse,
  ReputationAttestation,
  ReputationHistoryEvent,
  ReputationHistoryResponse,
  Erc8004ValidationRecord,
  Erc8004ValidationStatusResponse,
  ValidationStatusBreakdown,
  DisputeStats,
  Erc8004ValidationSummary,
} from './hooks/useErc8004Agent';

// File storage hooks
export { useFiles, useFileMetadata, useFileMutations, useUnregisterStorageNode } from './hooks/useFiles';

// Privacy hooks
export {
  useKeyGrant,
  useKeyGrantees,
  useGrantKey,
  useRevokeKey,
  useRotateKey,
} from './hooks/usePrivacy';
export type {
  EncryptedKeyGrant,
  GrantKeyParams,
  RevokeKeyParams,
  RotateKeyParams,
} from './hooks/usePrivacy';

// Computed Fields hooks
export {
  useComputedFieldRegistry,
  useComputedQuery,
  usePaginatedComputedQuery,
  useApplyComputedFields,
  useApplyComputedFieldsToResponse,
} from './hooks/useComputedFields';

// Re-export computed fields from SDK
export {
  ComputedFieldRegistry,
  applyComputedFields,
  applyComputedFieldsToResponse,
  globalComputedFieldRegistry,
  // Pre-built field sets for common protocols
  UNISWAP_V2_PAIR_FIELDS,
  UNISWAP_V2_TOKEN_FIELDS,
  UNISWAP_V2_AGGREGATION_FIELDS,
  GENERIC_AMM_PAIR_FIELDS,
  LENDING_PROTOCOL_FIELDS,
  LP_SHARE_FIELDS,
} from '@willow/sdk';

export type {
  ComputedFieldDefinition,
  ComputedFieldSet,
  ComputeFunction,
} from '@willow/sdk';