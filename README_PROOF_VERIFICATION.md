# GroveDB Proof Verification in React SDK

This document explains how proof verification works in the Willow React SDK and how to use it effectively in React applications.

## Overview

The React SDK provides React hooks that leverage the TypeScript SDK's proof verification functionality. This ensures data integrity by verifying cryptographic proofs against the blockchain consensus, all within React's component model.

## Implementation Status

### ✅ Implemented
- Automatic proof verification in `useData` and `useQuery` hooks
- Manual verification hooks (`useProofVerification`)
- Configuration management (`useProofConfig`)
- Performance mode options (skip verification)
- Server-assisted verification support
- Provider-level configuration
- Full TypeScript support

### ⚠️ Limitations
- Inherits TypeScript SDK limitations (cannot parse full GroveDB format)
- Server-assisted verification requires `/verify-proof` endpoint
- Verification adds latency to data fetching

## Usage

### 1. Provider Configuration

Configure proof verification at the provider level:

```tsx
import { WillowProvider } from '@willow/react-hooks';

function App() {
  return (
    <WillowProvider 
      config={{
        apiUrl: 'http://localhost:3031',
        did: 'did:willow:example',
        privateKey: 'your-private-key'
      }}
      proofVerificationOptions={{
        // Enable server-assisted verification
        serverAssisted: true,
        apiUrl: 'http://localhost:3031',
        
        // Or set expected root hash
        // expectedRootHash: 'abc123...'
      }}
    >
      <YourApp />
    </WillowProvider>
  );
}
```

### 2. Automatic Verification (Default)

Data fetching hooks automatically verify proofs:

```tsx
import { useData, useQuery } from '@willow/react-hooks';

function MyComponent() {
  // Single item - automatically verified
  const { data, error, isLoading } = useData('myapp', 'users', 'user123');
  
  // Query - automatically verified
  const queryResult = useQuery('myapp', 'users', {
    where: { active: true },
    limit: 10
  });
  
  if (isLoading) return <div>Loading and verifying...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h2>Verified Data</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### 3. Performance Mode (Skip Verification)

For trusted environments or performance-critical paths:

```tsx
function FastComponent() {
  // Skip verification for single item
  const { data: fastData } = useData(
    'myapp', 
    'users', 
    'user123',
    { skipVerification: true }
  );
  
  // Skip verification for query
  const { data: fastQuery } = useQuery(
    'myapp',
    'users',
    { where: { active: true } },
    { skipVerification: true }
  );
  
  return <div>Unverified but fast: {fastData?.name}</div>;
}
```

### 4. Manual Proof Verification

Use the `useProofVerification` hook for manual control:

```tsx
import { useProofVerification } from '@willow/react-hooks';

function ProofVerifier() {
  const {
    verifyQueryProof,
    verifyItemProof,
    extractRootHash,
    getVerifiedRootHash,
    verifyAgainstConsensus,
    isVerifying,
    verificationError
  } = useProofVerification();
  
  const handleVerify = async () => {
    try {
      // Get a proof somehow
      const proof = await fetchProof();
      
      // Option 1: Verify and get root hash
      const rootHash = await verifyQueryProof(proof, documents);
      
      // Option 2: Verify against consensus
      const isValid = await verifyAgainstConsensus(proof, documents);
      
      // Option 3: Just extract root hash
      const extracted = await extractRootHash(proof);
      
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };
  
  return (
    <button onClick={handleVerify} disabled={isVerifying}>
      {isVerifying ? 'Verifying...' : 'Verify Proof'}
    </button>
  );
}
```

### 5. Dynamic Configuration

Change proof verification settings at runtime:

```tsx
import { useProofConfig } from '@willow/react-hooks';

function ConfigPanel() {
  const {
    currentOptions,
    updateProofOptions,
    enableServerAssisted,
    setExpectedRootHash,
    resetToDefault
  } = useProofConfig();
  
  return (
    <div>
      <h3>Proof Verification Settings</h3>
      
      <button onClick={() => enableServerAssisted()}>
        Use Server Verification
      </button>
      
      <button onClick={() => {
        // Set expected root from consensus
        const rootHash = await getConsensusRootHash();
        setExpectedRootHash(rootHash);
      }}>
        Lock to Current Consensus
      </button>
      
      <button onClick={resetToDefault}>
        Reset to Default
      </button>
      
      <div>
        Current: {currentOptions?.serverAssisted ? 'Server' : 'Local'}
      </div>
    </div>
  );
}
```

### 6. Paginated Queries with Verification

The `usePaginatedQuery` hook includes automatic verification:

```tsx
import { usePaginatedQuery } from '@willow/react-hooks';

function PaginatedList() {
  const {
    documents,
    page,
    totalPages,
    nextPage,
    previousPage,
    hasNextPage,
    isLoading
  } = usePaginatedQuery(
    'myapp',
    'users',
    { where: { active: true } },
    20 // page size
  );
  
  return (
    <div>
      {documents.map(doc => (
        <div key={doc.id}>{doc.name}</div>
      ))}
      
      <div>
        Page {page + 1} of {totalPages}
        <button onClick={previousPage} disabled={page === 0}>
          Previous
        </button>
        <button onClick={nextPage} disabled={!hasNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}
```

### 7. Error Handling

Handle verification errors gracefully:

```tsx
function DataWithErrorHandling() {
  const { data, error, isLoading } = useData('myapp', 'users', 'user123');
  
  if (isLoading) return <Spinner />;
  
  if (error) {
    if (error.message.includes('PROOF_VERIFICATION_FAILED')) {
      return (
        <Alert severity="error">
          ⚠️ Data verification failed - possible tampering detected
        </Alert>
      );
    }
    return <Alert severity="error">{error.message}</Alert>;
  }
  
  return <UserProfile user={data} verified={true} />;
}
```

## Hook Reference

### `useData` Options

```typescript
interface UseDataOptions {
  skipVerification?: boolean;  // Skip proof verification
  suspense?: boolean;         // Enable React Suspense
  // ... other SWR options
}
```

### `useQuery` Options

```typescript
interface UseQueryOptions {
  skipVerification?: boolean;  // Skip proof verification
  // ... other SWR options
}
```

### `useProofVerification` Returns

```typescript
interface ProofVerificationHook {
  verifyQueryProof: (proof: string, documents: any[]) => Promise<string>;
  verifyItemProof: (proof: string, key: string, value: any, path?: string[]) => Promise<string>;
  extractRootHash: (proof: string) => Promise<string>;
  getVerifiedRootHash: () => Promise<string>;
  verifyAgainstConsensus: (proof: string, documents: any[]) => Promise<boolean>;
  createVerifier: (options: ProofVerificationOptions) => GroveDBProofVerifier;
  isVerifying: boolean;
  verificationError: Error | null;
}
```

### `useProofConfig` Returns

```typescript
interface ProofConfigHook {
  currentOptions: ProofVerificationOptions | null;
  updateProofOptions: (options: ProofVerificationOptions) => void;
  enableServerAssisted: (apiUrl?: string) => void;
  setExpectedRootHash: (rootHash: string) => void;
  resetToDefault: () => void;
}
```

## Best Practices

1. **Default to Verified**: Always use verified data fetching unless you have a specific reason not to
2. **Cache Verification Results**: The hooks use SWR for caching, reducing repeated verifications
3. **Handle Errors**: Always handle verification failures appropriately
4. **Performance Considerations**: Use `skipVerification` only in trusted environments
5. **Server-Assisted for Production**: Consider server-assisted verification for better reliability

## Example Application

See `examples/ProofVerificationExample.tsx` for a complete example showing:
- Automatic verification
- Manual verification
- Performance mode
- Configuration management
- Error handling
- Root hash comparison

## Testing

When testing components that use proof verification:

```tsx
import { render } from '@testing-library/react';
import { WillowProvider } from '@willow/react-hooks';

test('verifies data', async () => {
  const { getByText } = render(
    <WillowProvider 
      config={mockConfig}
      proofVerificationOptions={{
        expectedRootHash: 'test-root-hash'
      }}
    >
      <MyComponent />
    </WillowProvider>
  );
  
  // Test verification behavior
});
```

## Troubleshooting

### "Proof verification failed"
- Check that the server is returning valid proofs
- Ensure consensus root hash is accessible
- Try enabling server-assisted verification

### Performance issues
- Use `skipVerification` for non-critical data
- Enable SWR caching options
- Consider batching requests

### "Cannot read property 'data' of undefined"
- Ensure WillowProvider is properly configured
- Check that client is authenticated before fetching

## Related Documentation

- [React SDK README](./README.md)
- [TypeScript SDK Proof Verification](../willow-typescript/README_PROOF_VERIFICATION.md)
- [Proof Verification Example](./examples/ProofVerificationExample.tsx)