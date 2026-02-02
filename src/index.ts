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
  useApps,
  useApp,
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
  useAppBalance,
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

// Indexing/GraphQL hooks
export {
  useSubgraphs,
  useSubgraph,
  useSubgraphStatus,
  useIndexers,
  useIndexer,
  useVerificationStats,
  useGraphQL,
  useGraphQLMutation,
} from './hooks/useIndexing';
export type {
  SubgraphInfo,
  SubgraphStatus,
  SubgraphIndexingStatus,
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
  HistoricalQueryRequest,
  HistoricalQueryResponse,
  CheckpointInfo,
} from '@willow/sdk';

// Re-export DEVNET_TEST_ACCOUNT from SDK
export { DEVNET_TEST_ACCOUNT } from '@willow/sdk';