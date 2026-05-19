/**
 * Willow React Hooks - Indexing and GraphQL Example
 *
 * Demonstrates blockchain indexing features:
 * 1. Query indexed blockchain data via GraphQL
 * 2. List available subgroves
 * 3. Check indexer status
 * 4. View verification statistics
 *
 * Willow provides blockchain indexing with cryptographic proofs for every
 * query result, enabling trustless verification.
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node with indexing enabled
 * - Have a deployed subgrove
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useSubgroves,
  useSubgrove,
  useSubgroveStatus,
  useIndexers,
  useGraphQL,
  useVerificationStats,
} from '@willow/react-hooks';

function IndexingContent() {
  const { isAuthenticated, generateAndRegister, clearIdentity, isGenerating } = useAuth();
  const [did, setDid] = useState<string | null>(null);

  if (!isAuthenticated || !did) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Indexing & GraphQL Demo</h1>
        <button
          onClick={async () => {
            const r = await generateAndRegister();
            setDid(r.did);
          }}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
      </div>
    );
  }

  return (
    <AuthenticatedContent
      did={did}
      onLogout={() => {
        clearIdentity();
        setDid(null);
      }}
    />
  );
}

function AuthenticatedContent({
  did,
  onLogout,
}: {
  did: string;
  onLogout: () => void;
}) {
  const [selectedSubgrove, setSelectedSubgrove] = useState<string>('uniswap-v3-mainnet');
  const [customQuery, setCustomQuery] = useState<string>(`query GetRecentSwaps {
  swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    amount0
    amount1
  }
}`);

  const { subgroves, isLoading: subgrovesLoading, error: subgrovesError } = useSubgroves();
  const { subgrove, isLoading: subgroveLoading } = useSubgrove(selectedSubgrove);
  const { status: indexingStatus, isLoading: statusLoading } = useSubgroveStatus(selectedSubgrove);
  const { indexers, isLoading: indexersLoading } = useIndexers();

  const {
    data: queryData,
    errors: queryErrors,
    isLoading: queryLoading,
    error: queryError,
    source,
    fallback,
    refetch: refetchQuery,
    execute,
    isExecuting,
  } = useGraphQL(selectedSubgrove, customQuery);

  const { stats: verificationStats, isLoading: statsLoading } = useVerificationStats();

  const [manualResult, setManualResult] = useState<any>(null);
  const handleManualQuery = async () => {
    try {
      const result = await execute(customQuery);
      setManualResult(result);
    } catch (err) {
      setManualResult({ error: String(err) });
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

      <section style={{ marginBottom: '30px' }}>
        <h2>Select Subgrove</h2>
        <select
          value={selectedSubgrove}
          onChange={(e) => setSelectedSubgrove(e.target.value)}
          style={{ padding: '5px', fontSize: '14px' }}
        >
          <option value="uniswap-v3-mainnet">Uniswap V3 Mainnet</option>
          <option value="aave-v3-ethereum">Aave V3 Ethereum</option>
          <option value="compound-v3-mainnet">Compound V3 Mainnet</option>
        </select>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>1. GraphQL Query</h2>
        <textarea
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          style={{ width: '100%', height: '150px', fontFamily: 'monospace', fontSize: '12px' }}
        />
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          <button onClick={() => refetchQuery()} disabled={queryLoading}>
            {queryLoading ? 'Querying...' : 'Execute (Auto)'}
          </button>
          <button onClick={handleManualQuery} disabled={isExecuting}>
            {isExecuting ? 'Executing...' : 'Execute (Manual)'}
          </button>
        </div>

        {queryError && <p style={{ color: 'red' }}>Error: {queryError.message}</p>}
        {queryErrors && queryErrors.length > 0 && (
          <pre style={{ color: 'red' }}>{JSON.stringify(queryErrors, null, 2)}</pre>
        )}

        {queryData && (
          <div style={{ marginTop: '10px', background: '#e8f5e9', padding: '10px' }}>
            <p>
              Result (source: <code>{source ?? 'unknown'}</code>
              {fallback ? ', fallback' : ''}):
            </p>
            <pre style={{ fontSize: '11px', overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(queryData, null, 2)}
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

      <section style={{ marginBottom: '30px' }}>
        <h2>2. Available Subgroves</h2>
        {subgrovesLoading ? (
          <p>Loading subgroves...</p>
        ) : subgrovesError ? (
          <p style={{ color: 'red' }}>Error: {subgrovesError.message}</p>
        ) : (
          <div>
            <p>Found {subgroves.length} subgroves:</p>
            <ul>
              {subgroves.slice(0, 5).map((sg) => (
                <li key={sg.subgrove_id}>
                  <strong>{sg.subgrove_id}</strong>: {sg.name || 'Unnamed'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>3. Subgrove Details</h2>
        {subgroveLoading ? (
          <p>Loading details...</p>
        ) : subgrove ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>ID:</strong> {subgrove.subgrove_id}
            </p>
            <p>
              <strong>Name:</strong> {subgrove.name}
            </p>
            <p>
              <strong>Owner:</strong> {subgrove.owner_did}
            </p>
          </div>
        ) : (
          <p>Subgrove not found</p>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>4. Indexing Status</h2>
        {statusLoading ? (
          <p>Loading status...</p>
        ) : indexingStatus ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>Latest Indexed Block:</strong> {indexingStatus.latest_block ?? 'N/A'}
            </p>
            <p>
              <strong>Chain Head Block:</strong> {indexingStatus.chain_head_block ?? 'N/A'}
            </p>
            <p>
              <strong>Blocks Behind:</strong> {indexingStatus.blocks_behind ?? 0}
            </p>
            <p>
              <strong>Synced:</strong> {indexingStatus.synced ? 'Yes' : 'Syncing...'}
            </p>
            <p>
              <strong>Health:</strong> {indexingStatus.health}
            </p>
          </div>
        ) : (
          <p>Status not available</p>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>5. Active Indexers</h2>
        {indexersLoading ? (
          <p>Loading indexers...</p>
        ) : (
          <div>
            <p>Found {indexers.length} indexers:</p>
            <ul>
              {indexers.slice(0, 5).map((idx) => (
                <li key={idx.did}>
                  <strong>{idx.did.substring(0, 20)}...</strong> — {idx.status}
                  {idx.moniker ? ` (${idx.moniker})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>6. Verification Statistics</h2>
        {statsLoading ? (
          <p>Loading stats...</p>
        ) : verificationStats ? (
          <div style={{ background: '#e3f2fd', padding: '10px' }}>
            <p>
              <strong>Total queries:</strong> {verificationStats.total_queries ?? 0}
            </p>
            <p>
              <strong>Verified queries:</strong> {verificationStats.verified_queries ?? 0}
            </p>
            <p>
              <strong>Failed verifications:</strong> {verificationStats.failed_verifications ?? 0}
            </p>
            <p>
              <strong>Avg verification time:</strong>{' '}
              {verificationStats.average_verification_time_ms ?? 0} ms
            </p>
          </div>
        ) : (
          <p>No verification stats available</p>
        )}
      </section>
    </div>
  );
}

export default function IndexingAndGraphQLExample() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <IndexingContent />
    </WillowProvider>
  );
}
