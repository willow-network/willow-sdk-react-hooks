/**
 * Example demonstrating GroveDB proof verification in React applications.
 *
 * Shows:
 * 1. Automatic proof verification with data fetching
 * 2. Manual proof verification against a hand-managed proof bytes
 * 3. Performance mode (skip verification)
 * 4. Server-assisted verification configuration
 * 5. Query verification
 * 6. Root-hash comparison against consensus
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useWillow,
  useData,
  useQuery,
  useProofVerification,
  useProofConfig,
  ProofVerificationOptions,
} from '@willow/react-hooks';

const DATASET = 'users';
const KEY = 'user-123';

// 1: Automatic verification via useData (the default).
function VerifiedDataExample() {
  const { data, error, isLoading } = useData(DATASET, KEY);

  if (isLoading) return <div>Loading and verifying data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Verified data</h3>
      <p>This data has been cryptographically verified against consensus.</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// 2: Performance mode — skip verification.
function UnverifiedDataExample() {
  const { data, error, isLoading } = useData(DATASET, KEY, { skipVerification: true });

  if (isLoading) return <div>Loading data (no verification)...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Unverified data (performance mode)</h3>
      <p>Fetched without proof verification for lower latency.</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// 3: Manual verification, comparing a proof against consensus.
function ManualVerificationExample() {
  const { config } = useWillow();
  const { verifyAgainstConsensus, isVerifying, verificationError } = useProofVerification();
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const handleVerify = async () => {
    if (!config) return;

    try {
      const response = await fetch(
        `${config.apiUrl}/proof/${DATASET}/${encodeURIComponent(KEY)}`,
      );
      const proofData = await response.json();

      if (proofData.success && proofData.data?.proof) {
        const isValid = await verifyAgainstConsensus(proofData.data.proof, [
          { key: KEY, value: { name: 'Test User' } },
        ]);
        setVerificationResult(isValid);
      }
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  return (
    <div>
      <h3>Manual proof verification</h3>
      <button onClick={handleVerify} disabled={isVerifying}>
        {isVerifying ? 'Verifying...' : 'Verify proof'}
      </button>

      {verificationError && (
        <div style={{ color: 'red' }}>Error: {verificationError.message}</div>
      )}

      {verificationResult !== null && (
        <div>Verification result: {verificationResult ? 'Valid' : 'Invalid'}</div>
      )}
    </div>
  );
}

// 4: Query with automatic verification.
function VerifiedQueryExample() {
  const { data, error, isLoading } = useQuery(DATASET, {
    filters: { age: { $gt: 18 } },
    limit: 10,
  });

  if (isLoading) return <div>Querying and verifying...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Verified query results</h3>
      <p>Found {data?.documents.length || 0} verified results</p>
      <ul>
        {data?.documents.map((doc: any, i: number) => (
          <li key={i}>{JSON.stringify(doc)}</li>
        ))}
      </ul>
    </div>
  );
}

// 5: Runtime configuration of proof verification.
function ProofConfigExample() {
  const { currentOptions, enableServerAssisted, setExpectedRootHash, resetToDefault } =
    useProofConfig();

  return (
    <div>
      <h3>Proof verification configuration</h3>

      <div>
        <button onClick={() => enableServerAssisted()}>Enable server-assisted</button>{' '}
        <button onClick={() => setExpectedRootHash('abc123...')}>Set expected root hash</button>{' '}
        <button onClick={resetToDefault}>Reset to default</button>
      </div>

      {currentOptions && (
        <div>
          <h4>Current options:</h4>
          <pre>{JSON.stringify(currentOptions, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// 6: Root-hash comparison.
function RootHashComparisonExample() {
  const { getVerifiedRootHash, extractRootHash } = useProofVerification();
  const { config } = useWillow();
  const [consensusRoot, setConsensusRoot] = useState<string>('');
  const [extractedRoot, setExtractedRoot] = useState<string>('');

  const compareRootHashes = async () => {
    if (!config) return;
    try {
      const consensus = await getVerifiedRootHash();
      setConsensusRoot(consensus);

      const proofResponse = await fetch(
        `${config.apiUrl}/proof/${DATASET}/${encodeURIComponent(KEY)}`,
      );
      const proofData = await proofResponse.json();

      if (proofData.data?.proof) {
        const extracted = await extractRootHash(proofData.data.proof);
        setExtractedRoot(extracted);
      }
    } catch (err) {
      console.error('Failed to get root hashes:', err);
    }
  };

  return (
    <div>
      <h3>Root hash comparison</h3>
      <button onClick={compareRootHashes}>Compare root hashes</button>

      {consensusRoot && (
        <div>
          <p>
            Consensus root: <code>{consensusRoot.substring(0, 16)}...</code>
          </p>
          <p>
            Extracted root: <code>{extractedRoot.substring(0, 16)}...</code>
          </p>
          <p>Match: {consensusRoot === extractedRoot ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
}

function App() {
  const { isAuthenticated, generateAndRegister, isGenerating } = useAuth();
  const [showExamples, setShowExamples] = useState({
    verified: true,
    unverified: false,
    manual: false,
    query: false,
    config: false,
    rootHash: false,
  });

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Proof Verification Examples</h2>
        <button onClick={() => generateAndRegister()} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>GroveDB Proof Verification Examples</h1>

      <div style={{ marginBottom: '20px' }}>
        {(['verified', 'unverified', 'manual', 'query', 'config', 'rootHash'] as const).map((key) => (
          <label key={key} style={{ marginRight: '10px' }}>
            <input
              type="checkbox"
              checked={showExamples[key]}
              onChange={(e) =>
                setShowExamples((s) => ({ ...s, [key]: e.target.checked }))
              }
            />{' '}
            {key}
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {showExamples.verified && <VerifiedDataExample />}
        {showExamples.unverified && <UnverifiedDataExample />}
        {showExamples.manual && <ManualVerificationExample />}
        {showExamples.query && <VerifiedQueryExample />}
        {showExamples.config && <ProofConfigExample />}
        {showExamples.rootHash && <RootHashComparisonExample />}
      </div>
    </div>
  );
}

export default function ProofVerificationExample() {
  const proofOptions: ProofVerificationOptions = {
    serverAssisted: false,
  };

  return (
    <WillowProvider
      config={{ apiUrl: 'http://localhost:3031' }}
      proofVerificationOptions={proofOptions}
    >
      <App />
    </WillowProvider>
  );
}
