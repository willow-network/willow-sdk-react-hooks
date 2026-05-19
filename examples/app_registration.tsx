/**
 * Willow React Hooks - Dataset Registration Example
 *
 * Demonstrates how to:
 * 1. Register a dataset with a typed schema
 * 2. List existing subgroves
 * 3. Inspect permissions for the current DID
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node
 * - Have WILL tokens for funding the dataset's subgrove
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useRegistration,
  useSubgroves,
  useDidPermissions,
} from '@willow/react-hooks';

function RegistrationContent() {
  const { isAuthenticated, generateAndRegister, clearIdentity, isGenerating } = useAuth();
  const [did, setDid] = useState<string | null>(null);

  if (!isAuthenticated || !did) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Dataset Registration Demo</h1>
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
  const [registrationStatus, setRegistrationStatus] = useState<string[]>([]);

  const addStatus = (message: string) => {
    setRegistrationStatus((prev) => [...prev, message]);
  };

  const { registerDataset, isRegistering, error: regError } = useRegistration();
  const { subgroves, isLoading: subgrovesLoading, refetch: refetchSubgroves } = useSubgroves();
  const { permissions, isLoading: permissionsLoading } = useDidPermissions(did);

  const handleRegisterDataset = async () => {
    try {
      addStatus('Registering dataset...');
      await registerDataset({
        dataset_id: 'products',
        name: 'Product Catalog',
        dataset_path: ['collections'],
        schema: {
          version: 1,
          fields: {
            sku: { type: 'string', indexed: true, required: true },
            name: { type: 'string', indexed: true, required: true },
            category: { type: 'string', indexed: true },
            price: { type: 'number', indexed: true },
          },
          indexes: [
            { name: 'by_category', fields: ['category'], unique: false, type: 'hash' },
            { name: 'by_price', fields: ['price'], unique: false, type: 'range' },
          ],
          required_fields: ['sku', 'name'],
        },
        owner_did: did,
        writers: [did],
        readers: [],
      });
      addStatus('Created dataset: products');
      refetchSubgroves();
    } catch (err) {
      addStatus(`Error: ${err}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Dataset Registration Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      <section style={{ marginBottom: '30px' }}>
        <h2>1. Register Dataset</h2>
        <p>Registers a typed dataset under your DID.</p>
        <button onClick={handleRegisterDataset} disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register Products Dataset'}
        </button>
        {regError && <p style={{ color: 'red' }}>Error: {regError.message}</p>}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>2. Existing Subgroves</h2>
        {subgrovesLoading ? (
          <p>Loading subgroves...</p>
        ) : subgroves.length === 0 ? (
          <p>No subgroves registered yet.</p>
        ) : (
          <ul>
            {subgroves.map((sg) => (
              <li key={sg.subgrove_id}>
                <strong>{sg.subgrove_id}</strong> — owner {sg.owner_did.substring(0, 20)}...
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>3. Your Permissions</h2>
        {permissionsLoading ? (
          <p>Loading permissions...</p>
        ) : permissions ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>Owned:</strong> {permissions.owned_subgroves.length}
            </p>
            <p>
              <strong>Admin:</strong> {permissions.admin_subgroves.length}
            </p>
            <p>
              <strong>Writer:</strong> {permissions.writer_subgroves.length}
            </p>
            <p>
              <strong>Reader:</strong> {permissions.reader_subgroves.length}
            </p>
          </div>
        ) : (
          <p>No permission data.</p>
        )}
      </section>

      <section style={{ marginTop: '30px', padding: '10px', background: '#f5f5f5' }}>
        <h3>Status Log</h3>
        {registrationStatus.length === 0 ? (
          <p>No actions yet.</p>
        ) : (
          registrationStatus.map((s, i) => (
            <p key={i} style={{ margin: '5px 0', fontFamily: 'monospace', fontSize: '12px' }}>
              {s}
            </p>
          ))
        )}
      </section>
    </div>
  );
}

export default function AppRegistrationExample() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <RegistrationContent />
    </WillowProvider>
  );
}
