/**
 * Willow React Hooks - App and Subgrove Registration Example
 *
 * This example demonstrates how to:
 * 1. Register an application
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
  useApps,
  useApp,
  useSubgroves,
  useDidPermissions,
} from '@willow/react-hooks';

function RegistrationContent() {
  const { isAuthenticated, session } = useWillow();
  const { generateAndRegister, isGenerating, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow App Registration Demo</h1>
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
  const [appId] = useState(`demo-app-${Date.now()}`);
  const [registrationStatus, setRegistrationStatus] = useState<string[]>([]);

  const addStatus = (message: string) => {
    setRegistrationStatus((prev) => [...prev, message]);
  };

  // Registration hooks
  const { registerApp, registerDataset, isRegistering, error: regError } = useRegistration();

  // Query hooks
  const { apps, isLoading: appsLoading, refetch: refetchApps } = useApps();
  const { app, isLoading: appLoading } = useApp(appId);
  const { subgroves, isLoading: subgrovesLoading, refetch: refetchSubgroves } = useSubgroves(appId);
  const { permissions, isLoading: permissionsLoading } = useDidPermissions(did);

  // 1. Register Application
  const handleRegisterApp = async () => {
    try {
      addStatus('Registering application...');
      await registerApp({
        app_id: appId,
        name: 'My E-commerce App',
        description: 'A demo e-commerce application',
        app_type: 'web',
        owner_did: did,
        admins: [],
      });
      addStatus(`✅ Registered app: ${appId}`);
      refetchApps();
    } catch (error) {
      addStatus(`❌ Error: ${error}`);
    }
  };

  // 2. Register Subgrove (Dataset)
  const handleRegisterSubgrove = async () => {
    try {
      addStatus('Registering subgrove...');
      await registerDataset({
        dataset_id: 'products',
        app_id: appId,
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
      addStatus(`✅ Created subgrove: ${appId}/products`);
      refetchSubgroves();
    } catch (error) {
      addStatus(`❌ Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow App Registration Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* Registration Actions */}
      <section style={{ marginBottom: '30px' }}>
        <h2>1. Register Application</h2>
        <button onClick={handleRegisterApp} disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register App'}
        </button>

        <h2 style={{ marginTop: '20px' }}>2. Create Subgrove</h2>
        <button onClick={handleRegisterSubgrove} disabled={isRegistering}>
          {isRegistering ? 'Creating...' : 'Create Products Subgrove'}
        </button>

        {regError && <p style={{ color: 'red' }}>Error: {regError.message}</p>}

        <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
          <h4>Status Log:</h4>
          {registrationStatus.map((s, i) => (
            <p key={i} style={{ margin: '5px 0' }}>
              {s}
            </p>
          ))}
        </div>
      </section>

      {/* List Apps */}
      <section style={{ marginBottom: '30px' }}>
        <h2>3. List Registered Apps</h2>
        {appsLoading ? (
          <p>Loading apps...</p>
        ) : (
          <div>
            <p>Found {apps.length} apps:</p>
            <ul>
              {apps.slice(0, 5).map((app: any) => (
                <li key={app.app_id}>
                  <strong>{app.app_id}</strong>: {app.name}
                </li>
              ))}
            </ul>
            <button onClick={() => refetchApps()}>Refresh</button>
          </div>
        )}
      </section>

      {/* App Details */}
      <section style={{ marginBottom: '30px' }}>
        <h2>4. App Details</h2>
        {appLoading ? (
          <p>Loading app details...</p>
        ) : app ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>App ID:</strong> {app.app_id}
            </p>
            <p>
              <strong>Name:</strong> {app.name}
            </p>
            <p>
              <strong>Owner:</strong> {app.owner_did?.substring(0, 30)}...
            </p>
          </div>
        ) : (
          <p>App not registered yet.</p>
        )}
      </section>

      {/* List Subgroves */}
      <section style={{ marginBottom: '30px' }}>
        <h2>5. List Subgroves</h2>
        {subgrovesLoading ? (
          <p>Loading subgroves...</p>
        ) : (
          <div>
            <p>Found {subgroves.length} subgroves:</p>
            <ul>
              {subgroves.map((sg: any) => (
                <li key={sg.subgrove_id}>
                  <strong>{sg.subgrove_id}</strong>: {sg.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* DID Permissions */}
      <section style={{ marginBottom: '30px' }}>
        <h2>6. Your Permissions</h2>
        {permissionsLoading ? (
          <p>Loading permissions...</p>
        ) : permissions ? (
          <div style={{ background: '#f5f5f5', padding: '10px' }}>
            <p>
              <strong>Owned Apps:</strong> {permissions.owned_apps?.length || 0}
            </p>
            <p>
              <strong>Admin Apps:</strong> {permissions.admin_apps?.length || 0}
            </p>
            <p>
              <strong>Writer Subgroves:</strong> {permissions.writer_subgroves?.length || 0}
            </p>
            <p>
              <strong>Reader Subgroves:</strong> {permissions.reader_subgroves?.length || 0}
            </p>
          </div>
        ) : (
          <p>No permissions data available.</p>
        )}
      </section>

      <section style={{ marginTop: '40px', padding: '20px', background: '#e8f5e9' }}>
        <h3>Data Organization</h3>
        <pre>
          {`App (${appId})
  └── Subgrove (products)
       └── Items (with schema validation)
       └── Indexes (for fast queries)`}
        </pre>
      </section>
    </div>
  );
}

export default function AppRegistrationExample() {
  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
      }}
    >
      <RegistrationContent />
    </WillowProvider>
  );
}
