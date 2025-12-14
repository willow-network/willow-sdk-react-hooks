/**
 * Willow React Hooks - Indexing and GraphQL Example
 *
 * This example demonstrates blockchain indexing features:
 * 1. Query indexed blockchain data via GraphQL
 * 2. List available subgraphs
 * 3. Check indexer status
 * 4. View verification statistics
 *
 * Willow provides blockchain indexing with cryptographic proofs for every
 * query result, enabling trustless verification.
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node with indexing enabled
 * - Have a deployed subgraph
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useSubgraphs,
  useSubgraph,
  useSubgraphStatus,
  useIndexers,
  useIndexer,
  useGraphQL,
  useGraphQLMutation,
  useVerificationStats,
} from '@willow/react-hooks';

function IndexingContent() {
  const { isAuthenticated, session } = useWillow();
  const { generateAndRegister, isGenerating, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Indexing & GraphQL Demo</h1>
        <button onClick={() => generateAndRegister()} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
      </div>
    );
  }

  return <AuthenticatedContent did={session!.did} onLogout={logout} />;
}

function AuthenticatedContent({
  did,
  onLogout,
}: {
  did: string;
  onLogout: () => void;
}) {
  const [selectedSubgraph, setSelectedSubgraph] = useState<string>('uniswap-v3-mainnet');
  const [customQuery, setCustomQuery] = useState<string>(`query GetRecentSwaps {
  swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    amount0
    amount1
  }
}`);

  // List all subgraphs
  const { subgraphs, isLoading: subgraphsLoading, error: subgraphsError } = useSubgraphs();

  // Get specific subgraph details
  const { subgraph, isLoading: subgraphLoading } = useSubgraph(selectedSubgraph);

  // Get subgraph indexing status
  const { status: indexingStatus, isLoading: statusLoading } = useSubgraphStatus(selectedSubgraph);

  // List indexers
  const { indexers, isLoading: indexersLoading } = useIndexers();

  // GraphQL query hook
  const {
    data: queryResult,
    isLoading: queryLoading,
    error: queryError,
    refetch: refetchQuery,
  } = useGraphQL(selectedSubgraph, customQuery);

  // GraphQL mutation hook (for manual queries)
  const { execute: executeQuery, isExecuting } = useGraphQLMutation(selectedSubgraph);

  // Verification statistics
  const { stats: verificationStats, isLoading: statsLoading } = useVerificationStats();

  // Handle manual query execution
  const [manualResult, setManualResult] = useState<any>(null);
  const handleManualQuery = async () => {
    try {
      const result = await executeQuery(customQuery);
      setManualResult(result);
    } catch (error) {
      setManualResult({ error: String(error) });
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Indexing & GraphQL Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* Subgraph Selector */}
      <section style={{ marginBottom: '30px' }}>
        <h2>Select Subgraph</h2>
        <select
          value={selectedSubgraph}
          onChange={(e) => setSelectedSubgraph(e.target.value)}
          style={{ padding: '5px', fontSize: '14px' }}
        >
          <option value="uniswap-v3-mainnet">Uniswap V3 Mainnet</option>
          <option value="aave-v3-ethereum">Aave V3 Ethereum</option>
          <option value="compound-v3-mainnet">Compound V3 Mainnet</option>
        </select>
      </section>

      {/* GraphQL Query */}
      <section style={{ marginBottom: '30px' }}>
        <h2>1. GraphQL Query (Blockchain Data)</h2>
        <textarea
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          style={{ width: '100%', height: '150px', fontFamily: 'monospace', fontSize: '12px' }}
        />
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          <button onClick={() => refetchQuery()} disabled={queryLoading}>
            {queryLoading ? 'Querying...' : 'Execute Query (Auto)'}
          </button>
          <button onClick={handleManualQuery} disabled={isExecuting}>
            {isExecuting ? 'Executing...' : 'Execute Query (Manual)'}
          </button>
        </div>

        {queryError && <p style={{ color: 'red' }}>Error: {queryError.message}</p>}

        {queryResult && (
          <div style={{ marginTop: '10px', background: '#e8f5e9', padding: '10px' }}>
            <p>✅ Query result (with cryptographic proof):</p>
            <pre style={{ fontSize: '11px', overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          </div>
        )}

        {manualResult && (
          <div style={{ marginTop: '10px', background: '#fff3e0', padding: '10px' }}>
            <p>Manual query result:</p>
            <pre style={{ fontSize: '11px', overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(manualResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* List Subgraphs */}
      <section style={{ marginBottom: '30px' }}>
        <h2>2. Available Subgraphs</h2>
        {subgraphsLoading ? (
          <p>Loading subgraphs...</p>
        ) : subgraphsError ? (
          <p style={{ color: 'red' }}>Error: {subgraphsError.message}</p>
        ) : (
          <div>
            <p>Found {subgraphs.length} subgraphs:</p>
            <ul>
              {subgraphs.slice(0, 5).map((sg: any) => (
                <li key={sg.id}>
                  <strong>{sg.id}</strong>: {sg.name || 'Unnamed'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Subgraph Details */}
      <section style={{ marginBottom: '30px' }}>
        <h2>3. Subgraph Details</h2>
        {subgraphLoading ? (
          <p>Loading details...</p>
        ) : subgraph ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>ID:</strong> {subgraph.id}
            </p>
            <p>
              <strong>Name:</strong> {subgraph.name}
            </p>
            <p>
              <strong>Status:</strong> {subgraph.status}
            </p>
            <p>
              <strong>Network:</strong> {subgraph.network}
            </p>
          </div>
        ) : (
          <p>Subgraph not found</p>
        )}
      </section>

      {/* Indexing Status */}
      <section style={{ marginBottom: '30px' }}>
        <h2>4. Indexing Status</h2>
        {statusLoading ? (
          <p>Loading status...</p>
        ) : indexingStatus ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>Latest Indexed Block:</strong> {indexingStatus.latestBlock || 'N/A'}
            </p>
            <p>
              <strong>Chain Head Block:</strong> {indexingStatus.chainHeadBlock || 'N/A'}
            </p>
            <p>
              <strong>Synced:</strong> {indexingStatus.synced ? '✅ Yes' : '🔄 Syncing...'}
            </p>
          </div>
        ) : (
          <p>Status not available</p>
        )}
      </section>

      {/* List Indexers */}
      <section style={{ marginBottom: '30px' }}>
        <h2>5. Active Indexers</h2>
        {indexersLoading ? (
          <p>Loading indexers...</p>
        ) : (
          <div>
            <p>Found {indexers.length} indexers:</p>
            <ul>
              {indexers.slice(0, 5).map((idx: any) => (
                <li key={idx.did}>
                  <strong>{idx.did?.substring(0, 20)}...</strong> - {idx.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Verification Stats */}
      <section style={{ marginBottom: '30px' }}>
        <h2>6. Verification Statistics</h2>
        {statsLoading ? (
          <p>Loading stats...</p>
        ) : verificationStats ? (
          <div style={{ background: '#e3f2fd', padding: '10px' }}>
            <p>
              <strong>Total Verifications:</strong> {verificationStats.totalVerifications || 0}
            </p>
            <p>
              <strong>Successful:</strong> {verificationStats.successful || 0}
            </p>
            <p>
              <strong>Failed:</strong> {verificationStats.failed || 0}
            </p>
          </div>
        ) : (
          <p>No verification stats available</p>
        )}
      </section>

      {/* Benefits Summary */}
      <section style={{ marginTop: '40px', padding: '20px', background: '#e8f5e9' }}>
        <h3>Key Benefits of Willow Indexing</h3>
        <ul>
          <li>✅ Cryptographic proofs for every query</li>
          <li>✅ Trustless verification of indexed data</li>
          <li>✅ Decentralized indexer network</li>
          <li>✅ Automatic reorg handling</li>
          <li>✅ 50-100x faster than alternatives</li>
        </ul>
      </section>
    </div>
  );
}

export default function IndexingAndGraphQLExample() {
  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
      }}
    >
      <IndexingContent />
    </WillowProvider>
  );
}
