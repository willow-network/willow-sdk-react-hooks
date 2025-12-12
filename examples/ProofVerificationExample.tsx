/**
 * Example demonstrating GroveDB proof verification in React applications
 * 
 * This example shows:
 * 1. Automatic proof verification with data fetching
 * 2. Manual proof verification
 * 3. Performance mode (no verification)
 * 4. Server-assisted verification
 * 5. Query verification
 */

import React, { useState, useEffect } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useData,
  useQuery,
  useProofVerification,
  useProofConfig,
  ProofVerificationOptions,
} from '@willow/react-hooks';

// Example 1: Basic data fetching with automatic proof verification
function VerifiedDataExample() {
  const { data, error, isLoading } = useData('myapp', 'users', 'user123');

  if (isLoading) return <div>Loading and verifying data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>✅ Verified Data</h3>
      <p>This data has been cryptographically verified against the blockchain consensus.</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// Example 2: Performance mode - skip verification
function UnverifiedDataExample() {
  const { data, error, isLoading } = useData(
    'myapp',
    'users',
    'user123',
    { skipVerification: true }
  );

  if (isLoading) return <div>Loading data (no verification)...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>⚡ Unverified Data (Performance Mode)</h3>
      <p>This data was fetched without proof verification for better performance.</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// Example 3: Manual proof verification
function ManualVerificationExample() {
  const { client } = useWillow();
  const { verifyAgainstConsensus, isVerifying, verificationError } = useProofVerification();
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const handleVerify = async () => {
    if (!client) return;

    try {
      // Get proof for some data
      const proofResponse = await fetch(
        `${client.config.apiUrl}/proof/myapp/users/user123`
      );
      const proofData = await proofResponse.json();

      if (proofData.success && proofData.data?.proof) {
        // Verify against consensus
        const isValid = await verifyAgainstConsensus(
          proofData.data.proof,
          [{ key: 'user123', value: { name: 'Test User' } }]
        );
        setVerificationResult(isValid);
      }
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  return (
    <div>
      <h3>🔍 Manual Proof Verification</h3>
      <button onClick={handleVerify} disabled={isVerifying}>
        {isVerifying ? 'Verifying...' : 'Verify Proof'}
      </button>

      {verificationError && (
        <div style={{ color: 'red' }}>Error: {verificationError.message}</div>
      )}

      {verificationResult !== null && (
        <div>
          Verification Result: {verificationResult ? '✅ Valid' : '❌ Invalid'}
        </div>
      )}
    </div>
  );
}

// Example 4: Query with automatic verification
function VerifiedQueryExample() {
  const { data, error, isLoading } = useQuery('myapp', 'users', {
    where: { age: { $gt: 18 } },
    limit: 10
  });

  if (isLoading) return <div>Querying and verifying...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>✅ Verified Query Results</h3>
      <p>Found {data?.documents.length || 0} verified results</p>
      <ul>
        {data?.documents.map((doc: any, i: number) => (
          <li key={i}>{JSON.stringify(doc)}</li>
        ))}
      </ul>
    </div>
  );
}

// Example 5: Configuration management
function ProofConfigExample() {
  const {
    currentOptions,
    enableServerAssisted,
    setExpectedRootHash,
    resetToDefault
  } = useProofConfig();

  return (
    <div>
      <h3>⚙️ Proof Verification Configuration</h3>

      <div>
        <button onClick={() => enableServerAssisted()}>
          Enable Server-Assisted Verification
        </button>
        <button onClick={() => setExpectedRootHash('abc123...')}>
          Set Expected Root Hash
        </button>
        <button onClick={resetToDefault}>
          Reset to Default
        </button>
      </div>

      {currentOptions && (
        <div>
          <h4>Current Options:</h4>
          <pre>{JSON.stringify(currentOptions, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Example 6: Root hash comparison
function RootHashComparisonExample() {
  const { getVerifiedRootHash, extractRootHash } = useProofVerification();
  const [consensusRoot, setConsensusRoot] = useState<string>('');
  const [extractedRoot, setExtractedRoot] = useState<string>('');

  const compareRootHashes = async () => {
    try {
      // Get consensus root hash
      const consensus = await getVerifiedRootHash();
      setConsensusRoot(consensus);

      // Get a proof and extract its root hash
      const proofResponse = await fetch('/api/proof/myapp/users/user123');
      const proofData = await proofResponse.json();

      if (proofData.data?.proof) {
        const extracted = await extractRootHash(proofData.data.proof);
        setExtractedRoot(extracted);
      }
    } catch (error) {
      console.error('Failed to get root hashes:', error);
    }
  };

  return (
    <div>
      <h3>🔐 Root Hash Comparison</h3>
      <button onClick={compareRootHashes}>Compare Root Hashes</button>

      {consensusRoot && (
        <div>
          <p>Consensus Root: <code>{consensusRoot.substring(0, 16)}...</code></p>
          <p>Extracted Root: <code>{extractedRoot.substring(0, 16)}...</code></p>
          <p>Match: {consensusRoot === extractedRoot ? '✅ Yes' : '❌ No'}</p>
        </div>
      )}
    </div>
  );
}

// Main app component
function App() {
  const [showExamples, setShowExamples] = useState({
    verified: true,
    unverified: false,
    manual: false,
    query: false,
    config: false,
    rootHash: false,
  });

  // Authentication
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    // Auto-login for demo
    if (!isAuthenticated) {
      login('your-private-key-here', 'did:willow:example#key-1');
    }
  }, [isAuthenticated, login]);

  if (!isAuthenticated) {
    return <div>Authenticating...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>🔐 GroveDB Proof Verification Examples</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={showExamples.verified}
            onChange={(e) => setShowExamples(s => ({ ...s, verified: e.target.checked }))}
          />
          Verified Data Fetching
        </label>
        <label style={{ marginLeft: '10px' }}>
          <input
            type="checkbox"
            checked={showExamples.unverified}
            onChange={(e) => setShowExamples(s => ({ ...s, unverified: e.target.checked }))}
          />
          Unverified (Performance Mode)
        </label>
        <label style={{ marginLeft: '10px' }}>
          <input
            type="checkbox"
            checked={showExamples.manual}
            onChange={(e) => setShowExamples(s => ({ ...s, manual: e.target.checked }))}
          />
          Manual Verification
        </label>
        <label style={{ marginLeft: '10px' }}>
          <input
            type="checkbox"
            checked={showExamples.query}
            onChange={(e) => setShowExamples(s => ({ ...s, query: e.target.checked }))}
          />
          Query Verification
        </label>
        <label style={{ marginLeft: '10px' }}>
          <input
            type="checkbox"
            checked={showExamples.config}
            onChange={(e) => setShowExamples(s => ({ ...s, config: e.target.checked }))}
          />
          Configuration
        </label>
        <label style={{ marginLeft: '10px' }}>
          <input
            type="checkbox"
            checked={showExamples.rootHash}
            onChange={(e) => setShowExamples(s => ({ ...s, rootHash: e.target.checked }))}
          />
          Root Hash Comparison
        </label>
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

// App wrapper with provider
export default function ProofVerificationExample() {
  // Configure proof verification options
  const proofOptions: ProofVerificationOptions = {
    // Start with local verification (default)
    serverAssisted: false,
    // Can be changed to server-assisted:
    // serverAssisted: true,
    // apiUrl: 'http://localhost:3031'
  };

  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
        did: 'did:willow:example',
        privateKey: 'your-private-key-here'
      }}
      proofVerificationOptions={proofOptions}
      autoConnect={true}
    >
      <App />
    </WillowProvider>
  );
}