/**
 * Willow React Hooks - Quickstart Example
 *
 * This example demonstrates the core workflow:
 * 1. Setup WillowProvider
 * 2. Generate a DID (identity)
 * 3. Store and query data with automatic proof verification
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node: ./scripts/start_node.sh
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useData,
  useDataMutation,
} from '@willow/react-hooks';

function QuickstartContent() {
  const { isAuthenticated, generateAndRegister, clearIdentity, isGenerating } = useAuth();
  const [did, setDid] = useState<string | null>(null);
  const [status, setStatus] = useState<string[]>([]);

  const addStatus = (message: string) => {
    setStatus((prev) => [...prev, message]);
  };

  const handleLogin = async () => {
    try {
      addStatus('Generating DID...');
      const result = await generateAndRegister();
      setDid(result.did);
      addStatus(`DID: ${result.did}`);
      addStatus('Authenticated successfully!');
    } catch (error) {
      addStatus(`Error: ${error}`);
    }
  };

  if (!isAuthenticated || !did) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow React Quickstart</h1>
        <p>Click to generate a DID and authenticate:</p>
        <button onClick={handleLogin} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
        <div style={{ marginTop: '20px' }}>
          {status.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <AuthenticatedContent
      did={did}
      onLogout={() => {
        clearIdentity();
        setDid(null);
        setStatus([]);
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
  // Dataset to read/write. In a real app you'd register this with
  // `useRegistration().registerDataset({...})` before storing data.
  const DATASET = 'quickstart-users';

  const { store } = useDataMutation(DATASET);
  const { data, isLoading, error, refetch } = useData(DATASET, 'user-1');

  const [storeStatus, setStoreStatus] = useState<string>('');

  const handleStore = async () => {
    try {
      setStoreStatus('Storing data...');
      await store('user-1', {
        name: 'Alice',
        email: 'alice@example.com',
        created: Date.now(),
      });
      setStoreStatus('Data stored successfully! Proof verified.');
      refetch();
    } catch (err) {
      setStoreStatus(`Error: ${err}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow React Quickstart</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      <section style={{ marginBottom: '20px' }}>
        <h2>1. Store Data</h2>
        <button onClick={handleStore}>Store User Data</button>
        {storeStatus && <p>{storeStatus}</p>}
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h2>2. Query Data (with Proof Verification)</h2>
        {isLoading && <p>Loading and verifying...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
        {data && (
          <div>
            <p>Data retrieved and proof verified:</p>
            <pre style={{ background: '#f5f5f5', padding: '10px' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
        {!data && !isLoading && !error && <p>No data stored yet.</p>}
        <button onClick={() => refetch()}>Refresh</button>
      </section>

      <section style={{ marginTop: '40px', color: '#666' }}>
        <h3>Quickstart Complete</h3>
        <p>All data operations include automatic cryptographic proof verification.</p>
      </section>
    </div>
  );
}

export default function QuickstartExample() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <QuickstartContent />
    </WillowProvider>
  );
}
