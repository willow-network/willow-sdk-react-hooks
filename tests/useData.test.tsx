import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useData } from '../src/hooks/useData';
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
      get: jest.fn(),
    },
  })),
}));

describe('useData', () => {
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

  it('should fetch data when authenticated', async () => {
    const testData = { name: 'Test Item', value: 42 };
    mockClient.data.get.mockResolvedValueOnce(testData);

    const { result, waitForNextUpdate } = renderHook(
      () => useData('app1', 'dataset1', 'key1'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(testData);
    expect(result.current.error).toBeUndefined();
    expect(mockClient.data.get).toHaveBeenCalledWith('app1', 'dataset1', 'key1');
  });

  it('should not fetch when not authenticated', () => {
    mockClient.auth.hasIdentity.mockReturnValue(false);

    const { result } = renderHook(
      () => useData('app1', 'dataset1', 'key1'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(mockClient.data.get).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const error = new Error('Network error');
    mockClient.data.get.mockRejectedValueOnce(error);

    const { result, waitForNextUpdate } = renderHook(
      () => useData('app1', 'dataset1', 'key1'),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(error);
  });

  it('should refetch data with mutate', async () => {
    const initialData = { value: 1 };
    const updatedData = { value: 2 };

    mockClient.data.get
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(updatedData);

    const { result, waitForNextUpdate } = renderHook(
      () => useData('app1', 'dataset1', 'key1'),
      { wrapper }
    );

    await waitForNextUpdate();
    expect(result.current.data).toEqual(initialData);

    await act(async () => {
      await result.current.mutate();
    });

    expect(result.current.data).toEqual(updatedData);
    expect(mockClient.data.get).toHaveBeenCalledTimes(2);
  });

  it('should handle null keys', () => {
    const { result } = renderHook(
      () => useData('app1', 'dataset1', null),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockClient.data.get).not.toHaveBeenCalled();
  });

  it('should update when key changes', async () => {
    const data1 = { id: 'key1', value: 1 };
    const data2 = { id: 'key2', value: 2 };

    mockClient.data.get
      .mockResolvedValueOnce(data1)
      .mockResolvedValueOnce(data2);

    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ key }) => useData('app1', 'dataset1', key),
      {
        wrapper,
        initialProps: { key: 'key1' }
      }
    );

    await waitForNextUpdate();
    expect(result.current.data).toEqual(data1);

    rerender({ key: 'key2' });

    await waitForNextUpdate();
    expect(result.current.data).toEqual(data2);
    expect(mockClient.data.get).toHaveBeenCalledTimes(2);
  });

  it('should support SWR options', async () => {
    const testData = { value: 'test' };
    mockClient.data.get.mockResolvedValue(testData);

    const { result, waitForNextUpdate } = renderHook(
      () => useData('app1', 'dataset1', 'key1', {
        refreshInterval: 1000,
        revalidateOnFocus: false,
      }),
      { wrapper }
    );

    await waitForNextUpdate();
    expect(result.current.data).toEqual(testData);
  });
});