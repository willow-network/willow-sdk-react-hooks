import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useCollection } from '../src/hooks/useCollection';
import { WillowClient } from '@willow/sdk';
import { SWRConfig } from 'swr';

// Mock the SDK
jest.mock('@willow/sdk', () => ({
  WillowClient: jest.fn().mockImplementation(() => ({
    auth: {
      hasIdentity: jest.fn().mockReturnValue(true),
      setIdentity: jest.fn(),
      signRequest: jest.fn(),
      getAuthHeaders: jest.fn(),
      getDid: jest.fn().mockReturnValue('did:willow:test:123'),
    },
    init: jest.fn(),
    data: {
      store: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

describe('useCollection', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map() }}>
      <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
        {children}
      </WillowProvider>
    </SWRConfig>
  );

  let mockClient: jest.Mocked<WillowClient>;

  beforeEach(() => {
    mockClient = new WillowClient() as jest.Mocked<WillowClient>;
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should provide collection operations', () => {
    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    expect(result.current).toHaveProperty('store');
    expect(result.current).toHaveProperty('update');
    expect(result.current).toHaveProperty('remove');
    expect(result.current).toHaveProperty('useItem');
    expect(result.current).toHaveProperty('isReady');
  });

  it('should store data', async () => {
    mockClient.data.store.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    const testData = { name: 'Test', value: 123 };

    await act(async () => {
      await result.current.store('key1', testData);
    });

    expect(mockClient.data.store).toHaveBeenCalledWith(
      'app1',
      'dataset1',
      { key1: testData }
    );
  });

  it('should update data', async () => {
    mockClient.data.update.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    const updatedData = { name: 'Updated', value: 456 };

    await act(async () => {
      await result.current.update('key1', updatedData);
    });

    expect(mockClient.data.update).toHaveBeenCalledWith(
      'app1',
      'dataset1',
      'key1',
      updatedData
    );
  });

  it('should remove data', async () => {
    mockClient.data.delete.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    await act(async () => {
      await result.current.remove('key1');
    });

    expect(mockClient.data.delete).toHaveBeenCalledWith(
      'app1',
      'dataset1',
      'key1'
    );
  });

  it('should handle errors in operations', async () => {
    const error = new Error('Storage failed');
    mockClient.data.store.mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    await expect(act(async () => {
      await result.current.store('key1', { value: 'test' });
    })).rejects.toThrow('Storage failed');
  });

  it('should not allow operations when not authenticated', async () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    expect(result.current.isReady).toBe(false);

    await expect(act(async () => {
      await result.current.store('key1', { value: 'test' });
    })).rejects.toThrow('Not authenticated');

    expect(mockClient.data.store).not.toHaveBeenCalled();
  });

  it('should provide useItem hook', async () => {
    const testData = { id: 'item1', name: 'Test Item' };
    mockClient.data.get.mockResolvedValueOnce(testData);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    const { result: itemResult, waitForNextUpdate } = renderHook(
      () => result.current.useItem('item1'),
      { wrapper }
    );

    expect(itemResult.current.isLoading).toBe(true);

    await waitForNextUpdate();

    expect(itemResult.current.data).toEqual(testData);
    expect(itemResult.current.isLoading).toBe(false);
  });

  it('should handle batch operations', async () => {
    mockClient.data.store.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    const items = {
      key1: { value: 1 },
      key2: { value: 2 },
      key3: { value: 3 },
    };

    await act(async () => {
      // Store multiple items at once
      await Promise.all(
        Object.entries(items).map(([key, value]) =>
          result.current.store(key, value)
        )
      );
    });

    expect(mockClient.data.store).toHaveBeenCalledTimes(3);
  });

  it('should handle concurrent operations', async () => {
    mockClient.data.store.mockResolvedValue(undefined);
    mockClient.data.update.mockResolvedValue(undefined);
    mockClient.data.delete.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useCollection('app1', 'dataset1'),
      { wrapper }
    );

    await act(async () => {
      await Promise.all([
        result.current.store('key1', { value: 1 }),
        result.current.update('key2', { value: 2 }),
        result.current.remove('key3'),
      ]);
    });

    expect(mockClient.data.store).toHaveBeenCalledTimes(1);
    expect(mockClient.data.update).toHaveBeenCalledTimes(1);
    expect(mockClient.data.delete).toHaveBeenCalledTimes(1);
  });
});