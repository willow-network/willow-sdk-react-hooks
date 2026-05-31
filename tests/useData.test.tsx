import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useData, useDataMutation, useBatchData } from '../src/hooks/useData';
import { WillowClient } from '@willow-network/sdk';

// Mock @willow-network/sdk. We build a fresh mock object per test via
// `makeMockClient()` below — jest's mock factory runs once at module init,
// so relying on chained `mockReturnValue` from the factory means state
// from one test (e.g., `hasIdentity.mockReturnValue(false)`) leaks into
// the next. Using a factory function per `beforeEach` keeps each test
// isolated.
jest.mock('@willow-network/sdk', () => ({
  WillowClient: jest.fn(),
}));

// Only the methods the hooks actually touch are stubbed — unmocked
// members are left undefined to catch accidental usage.
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

// Each test gets its own SWR cache via a fresh provider — otherwise SWR
// would dedupe fetch calls across tests and cause false negatives.
const wrapper =
  ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map() }}>
      <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
        {children}
      </WillowProvider>
    </SWRConfig>
  );

describe('useData', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = makeMockClient();
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data when authenticated and returns it', async () => {
    const record = { name: 'Test', value: 42 };
    mockClient.data.getData.mockResolvedValueOnce(record);

    const { result } = renderHook(
      () => useData('my-subgrove', 'key1'),
      { wrapper },
    );

    // SWR resolves on next tick
    await waitFor(() => expect(result.current.data).toEqual(record));
    expect(result.current.error).toBeUndefined();
    expect(mockClient.data.getData).toHaveBeenCalledWith('my-subgrove', 'key1');
    expect(mockClient.data.getDataUnverified).not.toHaveBeenCalled();
  });

  it('skips fetching when key is null', () => {
    const { result } = renderHook(
      () => useData('my-subgrove', null),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockClient.data.getData).not.toHaveBeenCalled();
  });

  it('skips fetching when not authenticated', () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useData('my-subgrove', 'key1'),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockClient.data.getData).not.toHaveBeenCalled();
  });

  it('surfaces fetch errors', async () => {
    const error = new Error('Network error');
    mockClient.data.getData.mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useData('my-subgrove', 'key1'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.data).toBeUndefined();
  });

  it('uses getDataUnverified when skipVerification is set', async () => {
    const record = { fast: 'path' };
    mockClient.data.getDataUnverified.mockResolvedValueOnce(record);

    const { result } = renderHook(
      () => useData('my-subgrove', 'key1', { skipVerification: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(record));
    expect(mockClient.data.getDataUnverified).toHaveBeenCalledWith(
      'my-subgrove',
      'key1',
    );
    expect(mockClient.data.getData).not.toHaveBeenCalled();
  });

  it('refetch re-invokes the fetcher', async () => {
    mockClient.data.getData
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });

    const { result } = renderHook(
      () => useData('my-subgrove', 'key1'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
    expect(mockClient.data.getData).toHaveBeenCalledTimes(2);
  });
});

describe('useDataMutation', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = makeMockClient();
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('store wraps the key/value into a batch record', async () => {
    mockClient.data.storeData.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useDataMutation('my-subgrove'),
      { wrapper },
    );

    const value = { name: 'Alice' };
    await act(async () => {
      const returned = await result.current.store('user-1', value);
      // store returns the stored value for caller convenience
      expect(returned).toBe(value);
    });

    // SDK's storeData takes a Record<string, any> — the hook packs the
    // single (key, value) into that shape. If this assertion fails, the
    // hook got out of sync with the SDK API again.
    expect(mockClient.data.storeData).toHaveBeenCalledWith('my-subgrove', {
      'user-1': value,
    });
  });

  it('update calls updateData(datasetId, key, value)', async () => {
    mockClient.data.updateData.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useDataMutation('my-subgrove'),
      { wrapper },
    );

    const value = { name: 'Alice v2' };
    await act(async () => {
      await result.current.update('user-1', value);
    });

    expect(mockClient.data.updateData).toHaveBeenCalledWith(
      'my-subgrove',
      'user-1',
      value,
    );
  });

  it('remove calls deleteData(datasetId, key)', async () => {
    mockClient.data.deleteData.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useDataMutation('my-subgrove'),
      { wrapper },
    );

    await act(async () => {
      await result.current.remove('user-1');
    });

    expect(mockClient.data.deleteData).toHaveBeenCalledWith(
      'my-subgrove',
      'user-1',
    );
  });

  it('rejects mutations when not authenticated', async () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useDataMutation('my-subgrove'),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.store('user-1', { any: 'thing' });
      }),
    ).rejects.toThrow('Not authenticated');

    expect(mockClient.data.storeData).not.toHaveBeenCalled();
  });

  it('propagates SDK errors from store', async () => {
    const error = new Error('Storage quota exceeded');
    mockClient.data.storeData.mockRejectedValueOnce(error);

    const { result } = renderHook(
      () => useDataMutation('my-subgrove'),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.store('user-1', { any: 'thing' });
      }),
    ).rejects.toThrow('Storage quota exceeded');
  });
});

describe('useBatchData', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = makeMockClient();
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('batchStore forwards the record array', async () => {
    mockClient.data.batchStore.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useBatchData('my-subgrove'),
      { wrapper },
    );

    const records = [
      { key: 'k1', value: { a: 1 } },
      { key: 'k2', value: { a: 2 } },
    ];

    await act(async () => {
      await result.current.batchStore(records);
    });

    expect(mockClient.data.batchStore).toHaveBeenCalledWith(
      'my-subgrove',
      records,
    );
  });

  it('getMultiple returns the SDK response verbatim', async () => {
    const response = { k1: { a: 1 }, k2: { a: 2 } };
    mockClient.data.getMultiple.mockResolvedValueOnce(response);

    const { result } = renderHook(
      () => useBatchData('my-subgrove'),
      { wrapper },
    );

    let got: any;
    await act(async () => {
      got = await result.current.getMultiple(['k1', 'k2']);
    });

    expect(got).toBe(response);
    expect(mockClient.data.getMultiple).toHaveBeenCalledWith(
      'my-subgrove',
      ['k1', 'k2'],
    );
  });

  it('rejects batch operations when not authenticated', async () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useBatchData('my-subgrove'),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.batchStore([{ key: 'k', value: {} }]);
      }),
    ).rejects.toThrow('Not authenticated');

    await expect(
      act(async () => {
        await result.current.getMultiple(['k']);
      }),
    ).rejects.toThrow('Not authenticated');
  });
});
