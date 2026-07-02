import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useAuth } from '../src/hooks/useAuth';
import { WillowClient } from '@willow-network/sdk';

// Acceptance vector for Willow's self-certifying DID scheme. The byte-exact
// derivation lives in @willow-network/sdk's `createDidFromWallet`:
//   did = "did:willow:z" + base58btc(SHA3-256(multicodec_prefix || public_key))
// Ed25519 pubkey a003201e65e47d578ad9bb17cb1d3590e9f504f55eac6ee40002e3ab9517c49c
//   => did:willow:zDZ1Qqspppayjd9LF3Pkebq64Fa2PuK8zFQDDc11citB2
//
// react-hooks is a thin wrapper: it only *passes through* whatever
// `createDidFromWallet` returns, so the byte-exact vector is asserted in the
// base SDK's own test suite. Here we pin the derived (self-certifying) shape as
// the fixture and verify the wrapper's onboarding flow around it.
const ACCEPTANCE_VECTOR_PUBKEY =
  'a003201e65e47d578ad9bb17cb1d3590e9f504f55eac6ee40002e3ab9517c49c';
const ACCEPTANCE_VECTOR_DID =
  'did:willow:zDZ1Qqspppayjd9LF3Pkebq64Fa2PuK8zFQDDc11citB2';
const ACCEPTANCE_VECTOR_KEY_ID = `${ACCEPTANCE_VECTOR_DID}#key-1`;

const didDocumentFixture = () => ({
  id: ACCEPTANCE_VECTOR_DID,
  publicKeys: [
    {
      id: ACCEPTANCE_VECTOR_KEY_ID,
      key_type: 'Ed25519VerificationKey2020',
      public_key_hex: ACCEPTANCE_VECTOR_PUBKEY,
    },
  ],
  created: Date.now(),
  updated: Date.now(),
});

// Mock the SDK. `createDidFromWallet` derives the self-certifying DID upstream;
// we stub it to return the acceptance-vector document.
jest.mock('@willow-network/sdk', () => ({
  WillowClient: jest.fn().mockImplementation(() => ({
    auth: {
      hasIdentity: jest.fn().mockReturnValue(false),
      setIdentity: jest.fn(),
      signRequest: jest.fn(),
      getAuthHeaders: jest.fn(),
      getDid: jest.fn(),
    },
    registerDid: jest.fn(),
    init: jest.fn(),
  })),
  generateWallet: jest.fn().mockReturnValue({
    privateKey: 'a'.repeat(64),
    publicKey: 'a003201e65e47d578ad9bb17cb1d3590e9f504f55eac6ee40002e3ab9517c49c',
  }),
  createDidFromWallet: jest.fn().mockReturnValue({
    id: 'did:willow:zDZ1Qqspppayjd9LF3Pkebq64Fa2PuK8zFQDDc11citB2',
    publicKeys: [
      {
        id: 'did:willow:zDZ1Qqspppayjd9LF3Pkebq64Fa2PuK8zFQDDc11citB2#key-1',
        key_type: 'Ed25519VerificationKey2020',
        public_key_hex:
          'a003201e65e47d578ad9bb17cb1d3590e9f504f55eac6ee40002e3ab9517c49c',
      },
    ],
    created: Date.now(),
    updated: Date.now(),
  }),
}));

describe('useAuth', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      {children}
    </WillowProvider>
  );

  let mockClient: any;

  beforeEach(() => {
    mockClient = new WillowClient() as any;
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should provide authentication state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.hasIdentity).toBe(false);
    expect(result.current.isGenerating).toBe(false);
  });

  it('should set identity with credentials', () => {
    mockClient.auth.hasIdentity.mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setIdentity(
        ACCEPTANCE_VECTOR_DID,
        'a'.repeat(64),
        ACCEPTANCE_VECTOR_KEY_ID
      );
    });

    expect(mockClient.auth.setIdentity).toHaveBeenCalledWith(
      ACCEPTANCE_VECTOR_DID,
      'a'.repeat(64),
      ACCEPTANCE_VECTOR_KEY_ID
    );
  });

  it('derives a self-certifying DID without touching the chain (step 1 of bootstrap)', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let identity: ReturnType<typeof result.current.generateIdentity> | undefined;
    act(() => {
      identity = result.current.generateIdentity();
    });

    // DID is the self-certifying, key-derived id (did:willow:z…) and the
    // verification-method id follows the {did}#key-1 convention.
    expect(identity!.did).toBe(ACCEPTANCE_VECTOR_DID);
    expect(identity!.publicKeyId).toBe(ACCEPTANCE_VECTOR_KEY_ID);
    expect(identity!.publicKey).toBe(ACCEPTANCE_VECTOR_PUBKEY);
    expect(identity!.didDocument.id).toBe(ACCEPTANCE_VECTOR_DID);

    // Deriving must NOT register or activate — the caller funds `did` first.
    expect(mockClient.registerDid).not.toHaveBeenCalled();
    expect(mockClient.auth.setIdentity).not.toHaveBeenCalled();
  });

  it('should generate and register new DID', async () => {
    mockClient.registerDid.mockResolvedValueOnce(didDocumentFixture());
    mockClient.auth.hasIdentity.mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const authResult = await result.current.generateAndRegister();
      expect(authResult.did).toBe(ACCEPTANCE_VECTOR_DID);
      expect(authResult.privateKey).toBe('a'.repeat(64));
      expect(authResult.publicKey).toBe(ACCEPTANCE_VECTOR_PUBKEY);
      expect(authResult.didDocument.id).toBe(ACCEPTANCE_VECTOR_DID);
    });

    expect(mockClient.registerDid).toHaveBeenCalled();
    expect(mockClient.auth.setIdentity).toHaveBeenCalledWith(
      ACCEPTANCE_VECTOR_DID,
      'a'.repeat(64),
      ACCEPTANCE_VECTOR_KEY_ID
    );
  });

  it('registers before activating identity (pre-fund → register → activate order)', async () => {
    mockClient.registerDid.mockResolvedValueOnce(didDocumentFixture());
    mockClient.auth.hasIdentity.mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.generateAndRegister();
    });

    // registerDid (fee paid from the funded id) must precede setIdentity.
    const registerOrder = mockClient.registerDid.mock.invocationCallOrder[0];
    const setIdentityOrder =
      mockClient.auth.setIdentity.mock.invocationCallOrder[0];
    expect(registerOrder).toBeLessThan(setIdentityOrder);
  });

  it('should handle clearIdentity', () => {
    // Setup identity state
    mockClient.auth.hasIdentity.mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Verify has identity
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hasIdentity).toBe(true);

    // Clear identity
    mockClient.auth.hasIdentity.mockReturnValue(false);

    act(() => {
      result.current.clearIdentity();
    });

    // After clearing, setIdentity is called with empty strings
    expect(mockClient.auth.setIdentity).toHaveBeenCalledWith('', '', '');
  });

  it('should track isGenerating state during generateAndRegister', async () => {
    let resolveRegister: (value: any) => void;
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockClient.registerDid.mockReturnValueOnce(registerPromise);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isGenerating).toBe(false);

    let generatePromise: Promise<any>;
    act(() => {
      generatePromise = result.current.generateAndRegister();
    });

    expect(result.current.isGenerating).toBe(true);

    await act(async () => {
      resolveRegister!(didDocumentFixture());
      await generatePromise!;
    });

    expect(result.current.isGenerating).toBe(false);
  });
});
