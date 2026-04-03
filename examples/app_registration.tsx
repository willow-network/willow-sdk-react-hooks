/**
 * Willow React Hooks - App and Subgrove Registration Example
 *
 * This example demonstrates how to:
 * 1. Register a subgrove
 * 2. Create subgroves for data organization
 * 3. List and query apps/subgroves
 * 4. Check permissions
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node
 * - Have WILL tokens for funding
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useRegistration,
  useSubgroves,
  useDidPermissions,
} from '@willow/react-hooks';

function RegistrationContent() {
  const { isAuthenticated, session } = useWillow();
  const { generateAndRegister, isGenerating, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Subgrove Registration Demo</h1>
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
  const [subgrovePrefix] = useState(`demo-${Date.now()}`);
  const [registrationStatus, setRegistrationStatus] = useState<string[]>([]);

  const addStatus = (message: string) => {
    setRegistrationStatus((prev) => [...prev, message]);
  };

  // Registration hooks
  const { registerDataset, isRegistering, error: regError } = useRegistration();

  // Query hooks


  const { subgroves, isLoading: subgrovesLoading, refetch: refetchSubgroves } = useSubgroves(subgrovePrefix);
  const { permissions, isLoading: permissionsLoading } = useDidPermissions(did);

  // 1. Register Subgrove

  // 2. Register Subgrove (Dataset)
  const handleRegisterSubgrove = async () => {
    try {
      addStatus('Registering subgrove...');
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
            { name: 'by_category', fields: ['category'], type: 'hash' },
            { name: 'by_price', fields: ['price'], type: 'range' },
          ],
          required_fields: ['sku', 'name'],
        },
        owner_did: did,
        writers: [did],
        readers: [],
      });
      addStatus(`✅ Created subgrove: products`);
      refetchSubgroves();
    } catch (error) {
      addStatus(`❌ Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Subgrove Registration Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* Registration Actions */}
      <section style={{ marginBottom: '30px' }}>
        <h2>1. Register Subgrove</h2>
