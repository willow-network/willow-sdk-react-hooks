import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useAuth } from '../src/hooks/useAuth';
import { WillowClient } from '@willow/sdk';

// Mock the SDK
jest.mock('@willow/sdk', () => ({
  WillowClient: jest.fn().mockImplementation(() => ({
    isAuthenticated: jest.fn().mockReturnValue(false),
    getSession: jest.fn().mockReturnValue(null),
    authenticate: jest.fn(),
    registerDid: jest.fn(),
    clearSession: jest.fn(),
  })),
  generateDid: jest.fn().mockReturnValue({
    did: 'did:willow:test:123',
    privateKey: 'a'.repeat(64),
    publicKeyId: 'did:willow:test:123#key-1',
    didDocument: {
      id: 'did:willow:test:123',
      public_keys: [{
        id: 'did:willow:test:123#key-1',
        key_type: 'Ed25519VerificationKey2020',
        public_key_hex: 'abc123',
      }],
      created: Date.now(),
      updated: Date.now(),
    },
  }),
}));

describe('useAuth', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      {children}
    </WillowProvider>
  );

  let mockClient: jest.Mocked<WillowClient>;

  beforeEach(() => {
    mockClient = new WillowClient() as jest.Mocked<WillowClient>;
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should provide authentication state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should authenticate with existing credentials', async () => {
    const mockSession = {
      did: 'did:willow:test:123',
      token: 'test-token',
      expires_at: Date.now() + 3600000,
    };

    mockClient.authenticate.mockResolvedValueOnce(mockSession);
    mockClient.isAuthenticated.mockReturnValue(true);
    mockClient.getSession.mockReturnValue(mockSession);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.authenticate(
        'did:willow:test:123',
        'a'.repeat(64),
        'did:willow:test:123#key-1'
      );
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session).toEqual(mockSession);
    expect(mockClient.authenticate).toHaveBeenCalledWith(
      'did:willow:test:123',
      'a'.repeat(64),
      'did:willow:test:123#key-1'
    );
  });

  it('should handle authentication errors', async () => {
    mockClient.authenticate.mockRejectedValueOnce(new Error('Invalid signature'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(act(async () => {
      await result.current.authenticate('did:test', 'key', 'keyId');
    })).rejects.toThrow('Invalid signature');

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should generate and register new DID', async () => {
    const mockSession = {
      did: 'did:willow:test:123',
      token: 'test-token',
      expires_at: Date.now() + 3600000,
    };

    mockClient.registerDid.mockResolvedValueOnce({
      id: 'did:willow:test:123',
      public_keys: [],
      created: Date.now(),
      updated: Date.now(),
    });
    mockClient.authenticate.mockResolvedValueOnce(mockSession);
    mockClient.isAuthenticated.mockReturnValue(true);
    mockClient.getSession.mockReturnValue(mockSession);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const authResult = await result.current.generateAndRegister();
      expect(authResult.did).toBe('did:willow:test:123');
    });

    expect(mockClient.registerDid).toHaveBeenCalled();
    expect(mockClient.authenticate).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle logout', async () => {
    // Setup authenticated state
    const mockSession = {
      did: 'did:willow:test:123',
      token: 'test-token',
      expires_at: Date.now() + 3600000,
    };
    mockClient.isAuthenticated.mockReturnValue(true);
    mockClient.getSession.mockReturnValue(mockSession);

    const { result, rerender } = renderHook(() => useAuth(), { wrapper });

    // Verify authenticated
    expect(result.current.isAuthenticated).toBe(true);

    // Logout
    mockClient.isAuthenticated.mockReturnValue(false);
    mockClient.getSession.mockReturnValue(null);

    act(() => {
      result.current.logout();
    });

    expect(mockClient.clearSession).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
  });

  it('should handle loading state', async () => {
    let resolveAuth: (value: any) => void;
    const authPromise = new Promise((resolve) => {
      resolveAuth = resolve;
    });
    mockClient.authenticate.mockReturnValueOnce(authPromise as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.authenticate('did:test', 'key', 'keyId');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveAuth!({
        did: 'did:test',
        token: 'token',
        expires_at: Date.now() + 3600000,
      });
    });

    expect(result.current.isLoading).toBe(false);
  });
});