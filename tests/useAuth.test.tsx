import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useAuth } from '../src/hooks/useAuth';
import { WillowClient } from '@willow-network/sdk';

// Mock the SDK
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
    publicKey: 'abc123',
  }),
  createDidFromWallet: jest.fn().mockReturnValue({
    id: 'did:willow:test:123',
    publicKeys: [{
      id: 'did:willow:test:123#key-1',
      key_type: 'Ed25519VerificationKey2020',
      public_key_hex: 'abc123',
    }],
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
        'did:willow:test:123',
        'a'.repeat(64),
        'did:willow:test:123#key-1'
      );
    });

    expect(mockClient.auth.setIdentity).toHaveBeenCalledWith(
      'did:willow:test:123',
      'a'.repeat(64),
      'did:willow:test:123#key-1'
    );
  });

  it('should generate and register new DID', async () => {
    mockClient.registerDid.mockResolvedValueOnce({
      id: 'did:willow:test:123',
      publicKeys: [{
        id: 'did:willow:test:123#key-1',
        key_type: 'Ed25519VerificationKey2020',
        public_key_hex: 'abc123',
      }],
      created: Date.now(),
      updated: Date.now(),
    });
    mockClient.auth.hasIdentity.mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const authResult = await result.current.generateAndRegister();
      expect(authResult.did).toBe('did:willow:test:123');
      expect(authResult.privateKey).toBe('a'.repeat(64));
      expect(authResult.publicKey).toBe('abc123');
    });

    expect(mockClient.registerDid).toHaveBeenCalled();
    expect(mockClient.auth.setIdentity).toHaveBeenCalledWith(
      'did:willow:test:123',
      'a'.repeat(64),
      'did:willow:test:123#key-1'
    );
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
      resolveRegister!({
        id: 'did:willow:test:123',
        publicKeys: [{
          id: 'did:willow:test:123#key-1',
          key_type: 'Ed25519VerificationKey2020',
          public_key_hex: 'abc123',
        }],
        created: Date.now(),
        updated: Date.now(),
      });
      await generatePromise!;
    });

    expect(result.current.isGenerating).toBe(false);
  });
});
