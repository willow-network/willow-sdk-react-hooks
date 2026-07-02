# Willow React Hooks

React hooks for easy integration with the Willow network. Built on top of `@willow-network/sdk`.

## Installation

```bash
npm install @willow-network/react-hooks @willow-network/sdk
# or
yarn add @willow-network/react-hooks @willow-network/sdk
```

## Quick Start

```tsx
import React from 'react';
import { WillowProvider, useAuth, useCollection, useData } from '@willow-network/react-hooks';

// 1. Wrap your app with WillowProvider
function App() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <NotesApp />
    </WillowProvider>
  );
}

// 2. Use hooks in your components
function NotesApp() {
  const { isAuthenticated, generateAndRegister } = useAuth();
  const { store } = useCollection('notes');

  // Auto-generate DID and authenticate
  const handleLogin = async () => {
    const { did, privateKey } = await generateAndRegister();
    console.log('Logged in as:', did);
  };

  // Store data
  const createNote = async () => {
    await store('note-1', {
      title: 'My Note',
      content: 'Hello from React!',
      created: Date.now(),
    });
  };

  // Read data with automatic caching + proof verification
  const { data: note, isLoading } = useData('notes', 'note-1');

  if (!isAuthenticated) {
    return <button onClick={handleLogin}>Generate DID & Login</button>;
  }

  return (
    <div>
      <button onClick={createNote}>Create Note</button>
      {isLoading ? (
        <p>Loading...</p>
      ) : note ? (
        <div>
          <h3>{note.title}</h3>
          <p>{note.content}</p>
        </div>
      ) : (
        <p>No note found</p>
      )}
    </div>
  );
}
```

## Core Hooks

### `useWillow()`

Access the Willow client and authentication state.

```tsx
const {
  client,          // WillowClient instance
  config,          // WillowConfig
  isAuthenticated, // Boolean: has an identity been set?
  hasIdentity,     // Same as isAuthenticated
  isLoading,       // Loading state
  error,           // Error state
  initialize,      // Initialize with existing credentials (optional)
  setIdentity,     // (did, privateKey, publicKeyId) => void
  clearIdentity,   // Clear the active identity
  registerDid,     // Register a DID document
} = useWillow();
```

### `useAuth()`

Authentication operations.

Willow DIDs are **self-certifying**: the id is derived from the public key
(`did:willow:z…`) by the SDK — it is not chosen. The chain's `RegisterDid`
check rejects any id that is not exactly this derivation. Because the id is
bound to the key, a brand-new DID must be **funded before it can be
registered**: someone transfers ≥ the registration fee to the derived id, then
the holder registers (the fee is paid from that balance).

```tsx
const {
  isAuthenticated,
  hasIdentity,
  setIdentity,         // (did, privateKey, publicKeyId) => void
  clearIdentity,       // Clear identity (effectively logout)
  generateIdentity,    // Derive DID + keypair only (no on-chain call) — fund before registering
  generateAndRegister, // Convenience: derive, register, and set identity (DID must be funded first)
  isGenerating,        // Loading state for generation
} = useAuth();

// Two-step bootstrap (the DID is derived, not chosen):
const { registerDid } = useWillow();
const handleOnboard = async () => {
  // 1. Derive the self-certifying DID + keypair (no chain interaction yet).
  const { did, privateKey, publicKeyId, didDocument } = generateIdentity();
  // Save privateKey securely to re-use this DID later.

  // 2. Fund `did`: transfer >= the registration fee to the derived id.
  await sendFunds(did); // your wallet / faucet / sponsor

  // 3. Register (fee is debited from the now-funded id) and activate.
  await registerDid(didDocument);
  setIdentity(did, privateKey, publicKeyId);
};

// Quick start for an already-funded DID:
const handleQuickStart = async () => {
  const { did, privateKey, publicKey, didDocument } = await generateAndRegister();
  // generateAndRegister only succeeds if the derived DID is already funded.
};
```

### `useData()`

Fetch a single record with SWR caching.

```tsx
const { data, error, isLoading, refetch } = useData(
  'dataset-id',
  'key',
  {
    // Optional SWR options + Willow-specific flags
    refreshInterval: 5000,
    skipVerification: false,
  }
);
```

### `useDataMutation()`

Mutations for a single dataset.

```tsx
const { store, update, remove } = useDataMutation('dataset-id');

await store('key', { name: 'value' });
await update('key', { name: 'new value' });
await remove('key');
```

### `useCollection()`

Convenience wrapper combining mutations + batch operations + per-key reads for a single dataset.

```tsx
const {
  collection,     // { datasetId, client } helper
  store,          // Store data
  update,         // Update data
  remove,         // Delete data
  batchStore,     // Batch insert
  getMultiple,    // Read multiple keys
  useItem,        // (key) => useData(datasetId, key)
} = useCollection('notes');

// Per-key reads with caching
const { data: note1 } = useItem('note-1');
const { data: note2 } = useItem('note-2');

// Batch insert
await batchStore([
  { key: 'note-3', value: { title: 'Note 3' } },
  { key: 'note-4', value: { title: 'Note 4' } },
]);
```

### `useQuery()`

Query indexed data with filters, sort, and pagination.

```tsx
const { data, documents, isLoading, error, refetch } = useQuery('dataset-id', {
  filters: { category: 'electronics' },
  sort: { field: 'price', order: 'asc' },
  limit: 20,
});

// `documents` is a convenience alias for data?.documents
```

### `useRegistration()`

Register datasets and deregister subgroves.

```tsx
const { registerDataset, deregisterSubgrove, isRegistering, error } = useRegistration();

await registerDataset({
  dataset_id: 'notes',
  name: 'User Notes',
  dataset_path: ['collections'],
  schema: {
    version: 1,
    fields: {
      title: { type: 'string', indexed: true, required: true },
      content: { type: 'string' },
    },
    indexes: [
      { name: 'by_title', fields: ['title'], unique: false, type: 'hash' },
    ],
    required_fields: ['title'],
  },
  owner_did: myDid,
  writers: [myDid],
  readers: [myDid],
});
```

### `useProof()`

Get cryptographic proofs.

```tsx
const { proof, error, isLoading } = useProof('dataset-id', 'key');

if (proof) {
  console.log('Merkle proof:', proof);
}
```

### `useFiles()` / `useFileMutations()`

Reads live on `useFiles`; uploads/downloads/deletes live on `useFileMutations`.

```tsx
import { useFiles, useFileMutations } from '@willow-network/react-hooks';

function FileManager() {
  const { files, isLoading } = useFiles('my-subgrove');
  const { upload, download, deleteFile } = useFileMutations('my-subgrove');

  const handleUpload = async (file: File) => {
    const data = Buffer.from(await file.arrayBuffer());
    await upload(file.name, file.name, data, 'https://storage1.example.com');
  };

  return (
    <div>
      {files?.map((f) => (
        <div key={f.file_key}>
          {f.filename} ({f.total_size} bytes)
        </div>
      ))}
    </div>
  );
}
```

## Advanced Usage

### Custom Configuration

```tsx
<WillowProvider
  config={{
    apiUrl: 'https://api.willow.tech',
    did: 'did:willow:z...', // self-certifying DID, derived from your public key
    privateKey: process.env.REACT_APP_PRIVATE_KEY,
  }}
  autoConnect={true}
>
  <App />
</WillowProvider>
```

### Error Handling

```tsx
function MyComponent() {
  const { error } = useWillow();
  const { store } = useDataMutation('dataset');

  const handleStore = async () => {
    try {
      await store('key', data);
    } catch (err) {
      // Handle store error
    }
  };

  if (error) {
    return <div>Global error: {error.message}</div>;
  }

  // ...
}
```

### Optimistic Updates

```tsx
import { mutate } from 'swr';

function NoteEditor({ noteId }) {
  const { data: note } = useData('notes', noteId);
  const { update } = useDataMutation('notes');

  const handleUpdate = async (newContent) => {
    const optimisticNote = { ...note, content: newContent };
    mutate(['data', 'notes', noteId], optimisticNote, false);

    try {
      await update(noteId, optimisticNote);
    } catch (err) {
      // Revert on error
      mutate(['data', 'notes', noteId]);
    }
  };
}
```

### Suspense Support

```tsx
import { Suspense } from 'react';

function App() {
  return (
    <WillowProvider config={config}>
      <Suspense fallback={<Loading />}>
        <Notes />
      </Suspense>
    </WillowProvider>
  );
}

function Notes() {
  const { data } = useData('notes', 'note-1', { suspense: true });
  return <div>{data.title}</div>;
}
```

### TypeScript

All hooks are fully typed. Define your data types as you go:

```tsx
interface Note {
  title: string;
  content: string;
  tags: string[];
  created: number;
}

function useNotes() {
  const { data } = useData('notes', 'note-1');
  // Cast at the call-site if you want sharper inference.
  return data as Note | null | undefined;
}
```

## Best Practices

1. **Provider placement:** put `WillowProvider` at the root of your app
2. **Error boundaries:** use React error boundaries for fatal errors
3. **Loading states:** always handle loading states in your UI
4. **Key management:** store private keys securely (never in source)
5. **Caching:** leverage SWR caching for repeated reads
6. **Batch operations:** prefer batch operations when storing many records

## Examples

See the `examples/` directory:

- **`quickstart.tsx`** — minimal: provider, generate DID, store, read
- **`app_registration.tsx`** — register datasets with schemas and indexes
- **`data_operations.tsx`** — store, batch store, get, query, update, delete
- **`indexing_and_graphql.tsx`** — GraphQL queries, subgroves, indexers, verification stats
- **`token_and_validators.tsx`** — token info, balances, fee schedules, validators (read-only)
- **`ProofVerificationExample.tsx`** — verified vs unverified reads, manual proof verification, server-assisted mode
- **`full_app_notes.tsx`** — complete notes app: auth, setup, CRUD, search

### Todo App Sketch

```tsx
function TodoApp() {
  const { isAuthenticated } = useAuth();
  const { store, remove, useItem } = useCollection('todos');
  const [todoIds, setTodoIds] = useState<string[]>([]);

  const addTodo = async (text: string) => {
    const id = `todo-${Date.now()}`;
    await store(id, { text, completed: false });
    setTodoIds((prev) => [...prev, id]);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    await store(id, { completed });
  };

  const deleteTodo = async (id: string) => {
    await remove(id);
    setTodoIds((prev) => prev.filter((t) => t !== id));
  };

  // ... render UI
}
```

## License

MIT
