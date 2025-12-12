# Willow React Hooks

React hooks for easy integration with the Willow network. Built on top of `@willow/sdk`.

## Installation

```bash
npm install @willow/react-hooks @willow/sdk
# or
yarn add @willow/react-hooks @willow/sdk
```

## Quick Start

```tsx
import React from 'react';
import { WillowProvider, useAuth, useCollection } from '@willow/react-hooks';

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
  const { store, useItem } = useCollection('my-app', 'notes');

  // Auto-generate DID and login
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

  // Use data with automatic caching
  const { data: note, isLoading } = useItem('note-1');

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
  session,         // Current session
  isAuthenticated, // Boolean auth state
  isLoading,       // Loading state
  error,           // Error state
  initialize,      // Initialize with existing credentials
  login,           // Login with privateKey
  logout,          // Clear session
  registerDid,     // Register a DID document
} = useWillow();
```

### `useAuth()`

Simplified authentication operations.

```tsx
const {
  isAuthenticated,
  session,
  login,
  logout,
  generateAndRegister, // Generate wallet, DID, register, and login
  isGenerating,        // Loading state for generation
} = useAuth();

// Quick start for new users
const handleQuickStart = async () => {
  const { did, privateKey, publicKey, didDocument } = await generateAndRegister();
  // Save privateKey securely for future logins
};
```

### `useData()`

Fetch data with SWR caching.

```tsx
const { data, error, isLoading, refetch } = useData(
  'app-id',
  'dataset-id',
  'key',
  {
    // SWR options
    refreshInterval: 5000,
    suspense: true,
  }
);
```

### `useDataMutation()`

Mutations for data operations.

```tsx
const { store, update, remove } = useDataMutation('app-id', 'dataset-id');

// Create or overwrite
await store('key', { name: 'value' });

// Update existing
await update('key', { name: 'new value' });

// Delete
await remove('key');
```

### `useCollection()`

Work with a specific collection (app + dataset).

```tsx
const {
  collection,     // Collection helper from SDK
  store,          // Store data
  update,         // Update data
  remove,         // Delete data
  batchStore,     // Batch operations
  getMultiple,    // Get multiple records
  useItem,        // Hook for individual items
} = useCollection('my-app', 'notes');

// Use individual items with caching
const { data: note1 } = useItem('note-1');
const { data: note2 } = useItem('note-2');

// Batch operations
await batchStore([
  { key: 'note-3', value: { title: 'Note 3' } },
  { key: 'note-4', value: { title: 'Note 4' } },
]);
```

### `useRegistration()`

Register apps and datasets.

```tsx
const { registerApp, registerDataset, isRegistering, error } = useRegistration();

// Register app
const app = await registerApp({
  app_id: 'my-app',
  name: 'My Application',
  description: 'A React app using Willow',
  app_type: 'web',
  owner_did: session.did,
  admins: [],
});

// Register dataset
const dataset = await registerDataset({
  dataset_id: 'notes',
  app_id: 'my-app',
  name: 'User Notes',
  dataset_path: ['collections'],
  schema: {
    version: 1,
    fields: {
      title: { type: 'string' },
      content: { type: 'string' },
    },
    indexes: [],
    required_fields: ['title'],
  },
  owner_did: session.did,
  writers: [session.did],
  readers: [session.did],
});
```

### `useProof()`

Get cryptographic proofs.

```tsx
const { proof, error, isLoading } = useProof('app-id', 'dataset-id', 'key');

if (proof) {
  console.log('Merkle proof:', proof);
}
```

## Advanced Usage

### Custom Configuration

```tsx
<WillowProvider 
  config={{
    apiUrl: 'https://api.willow.network',
    did: 'did:willow:eth:0x...',
    privateKey: process.env.REACT_APP_PRIVATE_KEY,
  }}
  autoConnect={true} // Auto-login on mount
>
  <App />
</WillowProvider>
```

### Error Handling

```tsx
function MyComponent() {
  const { error } = useWillow();
  const { store } = useDataMutation('app', 'dataset');

  const handleStore = async () => {
    try {
      await store('key', data);
    } catch (error) {
      if (error.code === 'INSUFFICIENT_PERMISSIONS') {
        // Handle permission error
      }
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
  const { data: note } = useData('app', 'notes', noteId);
  const { update } = useDataMutation('app', 'notes');

  const handleUpdate = async (newContent) => {
    // Optimistic update
    const optimisticNote = { ...note, content: newContent };
    mutate(['data', 'app', 'notes', noteId], optimisticNote, false);

    try {
      await update(noteId, optimisticNote);
    } catch (error) {
      // Revert on error
      mutate(['data', 'app', 'notes', noteId]);
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
  // Will suspend while loading
  const { data } = useData('app', 'notes', 'note-1', { suspense: true });
  return <div>{data.title}</div>;
}
```

### TypeScript

All hooks are fully typed. Define your data types:

```tsx
interface Note {
  title: string;
  content: string;
  tags: string[];
  created: number;
}

function useNotes() {
  const { data } = useData<Note>('my-app', 'notes', 'note-1');
  // data is typed as Note | undefined
}
```

## Best Practices

1. **Provider Placement**: Place `WillowProvider` at the root of your app
2. **Error Boundaries**: Use React error boundaries for error handling
3. **Loading States**: Always handle loading states in your UI
4. **Key Management**: Store private keys securely (never in code)
5. **Caching**: Leverage SWR's caching for better performance
6. **Batch Operations**: Use batch operations when updating multiple records

## Examples

### Todo App with Real-time Sync

```tsx
function TodoApp() {
  const { isAuthenticated } = useAuth();
  const { store, remove, useItem } = useCollection('todo-app', 'todos');
  const [todos, setTodos] = useState<string[]>([]);

  // Fetch all todos
  const todoItems = todos.map(id => {
    const { data } = useItem(id);
    return { id, ...data };
  });

  const addTodo = async (text: string) => {
    const id = `todo-${Date.now()}`;
    await store(id, { text, completed: false });
    setTodos([...todos, id]);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    await store(id, { completed });
  };

  const deleteTodo = async (id: string) => {
    await remove(id);
    setTodos(todos.filter(t => t !== id));
  };

  // ... render UI
}
```

## License

MIT