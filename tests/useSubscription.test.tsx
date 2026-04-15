import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useSubscription } from '../src/hooks/useSubscription';
import { WillowClient } from '@willow/sdk';

// We mock the SDK so each test can drive the subscription surface by
// calling the captured `onNext` callback directly — no real WebSocket.
// The SDK-level protocol (connect_init / connection_ack / subscribe /
// next) is exercised thoroughly in the TS SDK's own test suite; here
// we're testing the *hook* — React state updates, cleanup, option
// forwarding, skip behavior.

jest.mock('@willow/sdk', () => ({
  WillowClient: jest.fn(),
}));

function makeMockClient() {
  // Track all subscribe calls — useful for asserting option forwarding.
  const subscribeCalls: Array<{
    subgroveId: string;
    query: string;
    onNext: (payload: any) => void;
    options: any;
    unsubscribe: jest.Mock;
  }> = [];

  return {
    _subscribeCalls: subscribeCalls,
    auth: {
      hasIdentity: jest.fn().mockReturnValue(true),
      setIdentity: jest.fn(),
      signRequest: jest.fn(),
      getAuthHeaders: jest.fn(),
      getDid: jest.fn().mockReturnValue('did:willow:test:123'),
    },
    init: jest.fn(),
    subscriptions: {
      subscribe: jest.fn(
        (subgroveId: string, query: string, onNext: any, options: any) => {
          const unsubscribe = jest.fn();
          subscribeCalls.push({ subgroveId, query, onNext, options, unsubscribe });
          return unsubscribe;
        },
      ),
    },
  };
}

const wrapper =
  ({ children }: { children: React.ReactNode }) => (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      {children}
    </WillowProvider>
  );

describe('useSubscription', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = makeMockClient();
    (WillowClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens a validator subscription by default', async () => {
    const { result } = renderHook(
      () => useSubscription('sg-1', 'subscription { x }'),
      { wrapper },
    );

    // `useWillow` bootstraps the client via an effect — give it a tick.
    await waitFor(() =>
      expect(mockClient.subscriptions.subscribe).toHaveBeenCalledTimes(1),
    );

    const call = mockClient._subscribeCalls[0];
    expect(call.subgroveId).toBe('sg-1');
    expect(call.query).toBe('subscription { x }');
    expect(call.options.source).toBe('validator');
    expect(result.current.isConnected).toBe(false); // no payloads yet
    expect(result.current.latest).toBeUndefined();
  });

  it('updates latest + flips isConnected on each payload', async () => {
    const { result } = renderHook(
      () => useSubscription('sg-1', 'subscription { x }'),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const { onNext } = mockClient._subscribeCalls[0];

    await act(async () => {
      onNext({ data: { tick: 1 } });
    });
    expect(result.current.latest).toEqual({ data: { tick: 1 } });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      onNext({ data: { tick: 2 } });
    });
    expect(result.current.latest).toEqual({ data: { tick: 2 } });
  });

  it('passes source=indexer through to the SDK', async () => {
    renderHook(
      () =>
        useSubscription('sg-1', 'subscription { x }', { source: 'indexer' }),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    expect(mockClient._subscribeCalls[0].options.source).toBe('indexer');
  });

  it('forwards variables and operationName', async () => {
    renderHook(
      () =>
        useSubscription('sg-1', 'subscription Foo($a: String) { x(a: $a) }', {
          variables: { a: 'hello' },
          operationName: 'Foo',
        }),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const call = mockClient._subscribeCalls[0];
    expect(call.options.variables).toEqual({ a: 'hello' });
    expect(call.options.operationName).toBe('Foo');
  });

  it('does not subscribe when subgroveId or query is null', async () => {
    const { rerender } = renderHook(
      ({ sg, q }: { sg: string | null; q: string | null }) =>
        useSubscription(sg, q),
      {
        wrapper,
        initialProps: { sg: null as string | null, q: 'subscription { x }' as string | null },
      },
    );

    // Short wait — confirms no subscribe call fired.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockClient.subscriptions.subscribe).not.toHaveBeenCalled();

    // Query null also blocks.
    rerender({ sg: 'sg-1', q: null });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockClient.subscriptions.subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when skip: true', async () => {
    renderHook(
      () => useSubscription('sg-1', 'subscription { x }', { skip: true }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 10));
    expect(mockClient.subscriptions.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(
      () => useSubscription('sg-1', 'subscription { x }'),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const { unsubscribe } = mockClient._subscribeCalls[0];

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes when inputs change (and tears the old one down)', async () => {
    const { rerender } = renderHook(
      ({ sg }: { sg: string }) =>
        useSubscription(sg, 'subscription { x }'),
      { wrapper, initialProps: { sg: 'sg-1' } },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const first = mockClient._subscribeCalls[0];

    rerender({ sg: 'sg-2' });
    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(2),
    );
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockClient._subscribeCalls[1].subgroveId).toBe('sg-2');
  });

  it('does NOT re-subscribe when only onPayload changes (ref-captured)', async () => {
    const { rerender } = renderHook(
      ({ cb }: { cb: (p: any) => void }) =>
        useSubscription('sg-1', 'subscription { x }', { onPayload: cb }),
      { wrapper, initialProps: { cb: () => {} } },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );

    // Change the callback; the subscription must stay up.
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockClient._subscribeCalls).toHaveLength(1);
  });

  it('invokes onPayload with each incoming payload', async () => {
    const received: any[] = [];
    renderHook(
      () =>
        useSubscription('sg-1', 'subscription { x }', {
          onPayload: (p) => received.push(p),
        }),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const { onNext } = mockClient._subscribeCalls[0];

    await act(async () => {
      onNext({ data: { tick: 1 } });
      onNext({ data: { tick: 2 } });
    });

    expect(received).toEqual([
      { data: { tick: 1 } },
      { data: { tick: 2 } },
    ]);
  });

  it('surfaces SDK transport errors via `error`', async () => {
    const { result } = renderHook(
      () => useSubscription('sg-1', 'subscription { x }'),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const { options } = mockClient._subscribeCalls[0];

    await act(async () => {
      options.onError(new Error('transport failed'));
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('transport failed');
    expect(result.current.isConnected).toBe(false);
  });

  it('manual unsubscribe() call closes the subscription', async () => {
    const { result } = renderHook(
      () => useSubscription('sg-1', 'subscription { x }'),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockClient._subscribeCalls).toHaveLength(1),
    );
    const { onNext, unsubscribe } = mockClient._subscribeCalls[0];

    await act(async () => {
      onNext({ data: { tick: 1 } });
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      result.current.unsubscribe();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(false);
  });
});
