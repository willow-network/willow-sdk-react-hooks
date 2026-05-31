import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useCollection } from '../src/hooks/useCollection';
import { WillowClient } from '@willow-network/sdk';

jest.mock('@willow-network/sdk', () => ({
  WillowClient: jest.fn(),
}));

// Fresh mock per test so `hasIdentity.mockReturnValue(false)` in one test
// doesn't leak into the next. See useData.test.tsx for the rationale.
function makeMockClient() {
  return {
    auth: {
      hasIdentity: jest.fn().mockReturnValue(true),
      setIdentity: jest.fn(),
      signRequest: jest.fn(),
      getAuthHeaders: jest.fn(),
      getDid: jest.fn().mockReturnValue('did:willow:test:123'),
    },
    init: jest.fn(),
    data: {
      getData: jest.fn(),
      getDataUnverified: jest.fn(),
      storeData: jest.fn(),
      updateData: jest.fn(),
      deleteData: jest.fn(),
      batchStore: jest.fn(),
      getMultiple: jest.fn(),
    },
  };
}

const wrapper =
  ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map() }}>
      <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
        {children}
      </WillowProvider>
    </SWRConfig>
  );

describe('useCollection', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = makeMockClient();
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exposes mutation helpers and a useItem escape hatch', () => {
    const { result } = renderHook(
      () => useCollection('my-subgrove'),
      { wrapper },
    );

    expect(typeof result.current.store).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.remove).toBe('function');
    expect(typeof result.current.batchStore).toBe('function');
    expect(typeof result.current.getMultiple).toBe('function');
    expect(typeof result.current.useItem).toBe('function');
    // `collection` carries the bound datasetId + raw client for escape
    // hatches (direct SDK calls that the hook doesn't wrap).
    expect(result.current.collection?.datasetId).toBe('my-subgrove');
    expect(result.current.collection?.client).toBe(mockClient);
  });

  it('store / update / remove delegate to the SDK with the bound datasetId', async () => {
    mockClient.data.storeData.mockResolvedValue(undefined);
    mockClient.data.updateData.mockResolvedValue(undefined);
    mockClient.data.deleteData.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useCollection('my-subgrove'),
      { wrapper },
    );

    const value = { name: 'Alice' };
    await act(async () => {
      await result.current.store('key1', value);
      await result.current.update('key1', { ...value, name: 'Alice v2' });
      await result.current.remove('key1');
    });

    // datasetId is injected by the hook — tests of the contract that
    // `useCollection(datasetId)` binds the ID for the caller.
    expect(mockClient.data.storeData).toHaveBeenCalledWith('my-subgrove', {
      key1: value,
    });
    expect(mockClient.data.updateData).toHaveBeenCalledWith(
      'my-subgrove',
      'key1',
      { ...value, name: 'Alice v2' },
    );
    expect(mockClient.data.deleteData).toHaveBeenCalledWith(
      'my-subgrove',
      'key1',
    );
  });

  it('batchStore and getMultiple delegate with the bound datasetId', async () => {
    mockClient.data.batchStore.mockResolvedValue(undefined);
    const response = { k1: { v: 1 }, k2: { v: 2 } };
    mockClient.data.getMultiple.mockResolvedValue(response);

    const { result } = renderHook(
      () => useCollection('my-subgrove'),
      { wrapper },
    );

    const records = [
      { key: 'k1', value: { v: 1 } },
      { key: 'k2', value: { v: 2 } },
    ];

    let got: any;
    await act(async () => {
      await result.current.batchStore(records);
      got = await result.current.getMultiple(['k1', 'k2']);
    });

    expect(mockClient.data.batchStore).toHaveBeenCalledWith(
      'my-subgrove',
      records,
    );
    expect(mockClient.data.getMultiple).toHaveBeenCalledWith(
      'my-subgrove',
      ['k1', 'k2'],
    );
    expect(got).toBe(response);
  });

  it('useItem fetches the bound dataset + provided key', async () => {
    const record = { greeting: 'hi' };
    mockClient.data.getData.mockResolvedValueOnce(record);

    const { result } = renderHook(
      () => {
        const collection = useCollection('my-subgrove');
        const item = collection.useItem('key-42');
        return { collection, item };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.item.data).toEqual(record));
    expect(mockClient.data.getData).toHaveBeenCalledWith(
      'my-subgrove',
      'key-42',
    );
  });

  it('useItem skips fetching when the key is null', () => {
    const { result } = renderHook(
      () => {
        const collection = useCollection('my-subgrove');
        const item = collection.useItem(null);
        return { collection, item };
      },
      { wrapper },
    );

    expect(result.current.item.isLoading).toBe(false);
    expect(result.current.item.data).toBeUndefined();
    expect(mockClient.data.getData).not.toHaveBeenCalled();
  });

  it('throws Not authenticated when identity is cleared', async () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useCollection('my-subgrove'),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.store('k', { v: 1 });
      }),
    ).rejects.toThrow('Not authenticated');
    await expect(
      act(async () => {
        await result.current.update('k', { v: 2 });
      }),
    ).rejects.toThrow('Not authenticated');
    await expect(
      act(async () => {
        await result.current.remove('k');
      }),
    ).rejects.toThrow('Not authenticated');
  });

  it('surfaces SDK errors unchanged', async () => {
    const err = new Error('Permission denied');
    mockClient.data.storeData.mockRejectedValueOnce(err);

    const { result } = renderHook(
      () => useCollection('my-subgrove'),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.store('k', { v: 1 });
      }),
    ).rejects.toThrow('Permission denied');
  });
});
