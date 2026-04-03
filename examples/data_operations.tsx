/**
 * Willow React Hooks - Data Operations Example
 *
 * This example demonstrates comprehensive data operations:
 * 1. Store single items
 * 2. Batch store multiple items
 * 3. Get single item (with proof verification)
 * 4. Get unverified (performance mode)
 * 5. Query with filters
 * 6. Update items
 * 7. Delete items
 *
 * All operations include automatic proof verification by default.
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node
 * - Register and fund a subgrove
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useData,
  useDataMutation,
  useQuery,
  useCollection,
} from '@willow/react-hooks';

function DataOperationsContent() {
  const { isAuthenticated, session } = useWillow();
  const { generateAndRegister, isGenerating, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Data Operations Demo</h1>
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
  const APP_ID = 'data-demo-app';
  const COLLECTION = 'products';

  const [operationLog, setOperationLog] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('prod-001');

  const addLog = (message: string) => {
    setOperationLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Data mutation hooks
  const { store, update, remove, batchStore } = useCollection(APP_ID, COLLECTION);

  // Data query hooks
  const {
    data: singleItem,
    isLoading: singleLoading,
    error: singleError,
    refetch: refetchSingle,
  } = useData(APP_ID, COLLECTION, selectedKey);

  // Unverified fetch (performance mode)
  const {
    data: unverifiedItem,
    isLoading: unverifiedLoading,
    refetch: refetchUnverified,
  } = useData(APP_ID, COLLECTION, selectedKey, { skipVerification: true });

  // Query with filters
  const {
    documents: electronicsProducts,
    isLoading: queryLoading,
    refetch: refetchQuery,
  } = useQuery(APP_ID, COLLECTION, {
    where: { category: 'electronics' },
    limit: 10,
  });

  // 1. Store single item
  const handleStoreSingle = async () => {
    try {
      addLog('Storing single item...');
      await store('prod-001', {
        id: 'prod-001',
        name: 'Laptop Pro',
        category: 'electronics',
        price: 1299.99,
        stock: 50,
      });
      addLog('✅ Stored product: prod-001');
      refetchSingle();
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // 2. Batch store multiple items
  const handleBatchStore = async () => {
    try {
      addLog('Batch storing items...');
      await batchStore([
        {
          key: 'prod-002',
          value: {
            id: 'prod-002',
            name: 'Wireless Mouse',
            category: 'electronics',
            price: 49.99,
            stock: 200,
          },
        },
        {
          key: 'prod-003',
          value: {
            id: 'prod-003',
            name: 'USB-C Cable',
            category: 'accessories',
            price: 19.99,
            stock: 500,
          },
        },
        {
          key: 'prod-004',
          value: {
            id: 'prod-004',
            name: 'Monitor 27"',
            category: 'electronics',
            price: 399.99,
            stock: 30,
          },
        },
      ]);
      addLog('✅ Batch stored 3 products');
      refetchQuery();
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // 3. Update item
  const handleUpdate = async () => {
    try {
      addLog('Updating item...');
      await update('prod-001', {
        id: 'prod-001',
        name: 'Laptop Pro',
        category: 'electronics',
        price: 1199.99, // Price reduced!
        stock: 45,
        on_sale: true,
      });
      addLog('✅ Updated prod-001 (price reduced, on_sale added)');
      refetchSingle();
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // 4. Delete item
  const handleDelete = async () => {
    try {
      addLog('Deleting item...');
      await remove('prod-004');
      addLog('✅ Deleted prod-004');
      refetchQuery();
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Data Operations Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* Store Operations */}
      <section style={{ marginBottom: '30px' }}>
        <h2>1. Store Operations</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleStoreSingle}>Store Single Item</button>
          <button onClick={handleBatchStore}>Batch Store (3 items)</button>
        </div>
      </section>

      {/* Get Single Item (Verified) */}
      <section style={{ marginBottom: '30px' }}>
        <h2>2. Get Single Item (Verified)</h2>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Key:{' '}
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              <option value="prod-001">prod-001</option>
              <option value="prod-002">prod-002</option>
              <option value="prod-003">prod-003</option>
              <option value="prod-004">prod-004</option>
            </select>
          </label>
        </div>
        {singleLoading ? (
          <p>Loading and verifying...</p>
        ) : singleError ? (
          <p style={{ color: 'red' }}>Error: {singleError.message}</p>
        ) : singleItem ? (
          <div style={{ background: '#e8f5e9', padding: '10px' }}>
            <p>✅ Proof verified</p>
            <pre>{JSON.stringify(singleItem, null, 2)}</pre>
          </div>
        ) : (
          <p>No data found</p>
        )}
        <button onClick={() => refetchSingle()}>Refresh (Verified)</button>
      </section>

      {/* Get Unverified (Performance Mode) */}
      <section style={{ marginBottom: '30px' }}>
        <h2>3. Get Unverified (Performance Mode)</h2>
        {unverifiedLoading ? (
          <p>Loading...</p>
        ) : unverifiedItem ? (
          <div style={{ background: '#fff3e0', padding: '10px' }}>
            <p>⚡ Fetched without proof verification (faster)</p>
            <pre>{JSON.stringify(unverifiedItem, null, 2)}</pre>
          </div>
        ) : (
          <p>No data found</p>
        )}
        <button onClick={() => refetchUnverified()}>Refresh (Unverified)</button>
      </section>

      {/* Query with Filters */}
      <section style={{ marginBottom: '30px' }}>
        <h2>4. Query with Filters</h2>
        <p>
          <em>Filter: category = "electronics"</em>
        </p>
        {queryLoading ? (
          <p>Querying...</p>
        ) : (
          <div>
            <p>Found {electronicsProducts.length} electronics products:</p>
            <ul>
              {electronicsProducts.map((doc: any, i: number) => (
                <li key={i}>
                  {doc.name} - ${doc.price}
                </li>
              ))}
            </ul>
            <button onClick={() => refetchQuery()}>Refresh Query</button>
          </div>
        )}
      </section>

      {/* Update & Delete */}
      <section style={{ marginBottom: '30px' }}>
        <h2>5. Update & Delete</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleUpdate}>Update prod-001 (reduce price)</button>
          <button onClick={handleDelete}>Delete prod-004</button>
        </div>
      </section>

      {/* Operation Log */}
      <section
        style={{
          marginTop: '30px',
          padding: '10px',
          background: '#f5f5f5',
          maxHeight: '200px',
          overflow: 'auto',
        }}
      >
        <h3>Operation Log</h3>
        {operationLog.length === 0 ? (
          <p>No operations yet.</p>
        ) : (
          operationLog.map((log, i) => (
            <p key={i} style={{ margin: '5px 0', fontFamily: 'monospace', fontSize: '12px' }}>
              {log}
            </p>
          ))
        )}
        {operationLog.length > 0 && (
          <button onClick={() => setOperationLog([])}>Clear Log</button>
        )}
      </section>
    </div>
  );
}

export default function DataOperationsExample() {
  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
      }}
    >
      <DataOperationsContent />
    </WillowProvider>
  );
}
