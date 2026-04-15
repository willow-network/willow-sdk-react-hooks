import { useEffect, useRef, useState } from 'react';
import type {
  SubscribeOptions,
  SubscribeSource,
  UnsubscribeFn,
} from '@willow/sdk';
import { useWillow } from './useWillow';

/**
 * The payload shape surfaced by a subscription — mirrors what the SDK
 * delivers to the underlying `onNext` callback.
 */
export interface UseSubscriptionPayload {
  data?: any;
  errors?: any[];
}

export interface UseSubscriptionOptions {
  /**
   * Route the subscription to the validator (consensus-verified chain-tip)
   * or an indexer (historical/indexer-side tail — useful for `VerifyOnly`
   * subgroves). Defaults to `'validator'`.
   */
  source?: SubscribeSource;
  /** GraphQL variables. */
  variables?: Record<string, any>;
  /** GraphQL operation name (for multi-op documents). */
  operationName?: string;
  /**
   * When `true`, skip opening the subscription. Useful for
   * conditionally subscribing based on component state.
   */
  skip?: boolean;
  /**
   * Called for every incoming payload. Use this for side effects — the
   * returned `latest` only captures the most-recent payload between
   * renders, so a slow render could drop intermediate ones.
   */
  onPayload?: (payload: UseSubscriptionPayload) => void;
  /** Arbitrary payload passed on `connection_init` (e.g., auth token). */
  connectionPayload?: Record<string, any>;
  /**
   * Automatically reconnect on unexpected disconnect. Defaults to
   * `true`. On a drop the SDK applies exponential backoff; for
   * `source: 'indexer'` it re-resolves a different indexer via
   * discovery (the failing indexer is evicted from the cache), so a
   * dead indexer won't pin the component.
   *
   * Reconnection is reconnect-only — messages that were in flight when
   * the socket dropped are not replayed, and the new connection may
   * redeliver events the old one already emitted. Dedupe by a stable
   * field (e.g., block number) if you need exactly-once.
   */
  reconnect?: boolean;
  /** Maximum reconnect attempts before giving up. Defaults to
   * `Infinity` — keep trying. When exhausted, the hook flips
   * `isConnected` to `false` permanently. */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay (ms). Doubles on each consecutive failure
   * up to `maxReconnectBackoffMs`. Defaults to 500. */
  reconnectBackoffMs?: number;
  /** Maximum reconnect delay (ms). Defaults to 30_000. */
  maxReconnectBackoffMs?: number;
  /** Called when a reconnect attempt is scheduled. `attempt` is
   * 1-indexed; `delayMs` is the backoff we'll sleep before trying. */
  onReconnect?: (attempt: number, delayMs: number) => void;
}

export interface UseSubscriptionResult {
  /** Most recent payload the hook has received, or `undefined` if none yet. */
  latest: UseSubscriptionPayload | undefined;
  /**
   * Whether the subscription is currently believed to be open. Flips
   * to `false` when the socket closes (server sent `complete`, the
   * connection dropped without reconnect, reconnect gave up, or the
   * caller unsubscribed). During a transient disconnect that the SDK
   * is about to reconnect, this flips to `false` and `isReconnecting`
   * flips to `true` — see those two together.
   */
  isConnected: boolean;
  /** Error from the transport or a GraphQL-protocol error. */
  error: unknown | undefined;
  /**
   * `true` while the SDK is waiting to reconnect after an unexpected
   * drop. Flips back to `false` once the next payload arrives on the
   * new socket (or the subscription gives up).
   */
  isReconnecting: boolean;
  /**
   * 1-indexed attempt counter while reconnecting; `0` otherwise. A
   * value of `3` means "about to start reconnect #3".
   */
  reconnectAttempt: number;
  /**
   * Manually close the subscription. Also runs automatically on
   * unmount or when the subscription's key (subgroveId/query/opts)
   * changes.
   */
  unsubscribe: () => void;
}

/**
 * Subscribe to a GraphQL subscription and stream updates into React state.
 *
 * Opens a `graphql-transport-ws` WebSocket via the TS SDK
 * (`client.subscriptions.subscribe`) when the component mounts, and
 * keeps `latest` updated with each server-sent `next` payload. On
 * unmount (or when inputs change), it sends `complete` and closes
 * cleanly.
 *
 * By default, the subscription targets the validator (consensus-verified
 * chain-tip events). Pass `{ source: 'indexer' }` to subscribe to an
 * indexer — required for `VerifyOnly` subgroves where the validator has
 * no tail data. The SDK resolves the indexer via discovery or the
 * explicit `indexerUrl` override configured on the `WillowClient`.
 *
 * Auto-reconnect is on by default. Show a "Reconnecting..." spinner by
 * reading `isReconnecting` + `reconnectAttempt` from the result.
 *
 * @example
 * ```tsx
 * function BlockStream({ subgroveId }: { subgroveId: string }) {
 *   const { latest, isConnected, isReconnecting, reconnectAttempt, error } =
 *     useSubscription(subgroveId, 'subscription { blockFinalized { height } }');
 *
 *   if (error) return <ErrorView err={error} />;
 *   if (isReconnecting) return <Reconnecting attempt={reconnectAttempt} />;
 *   if (!isConnected) return <Connecting />;
 *   return <BlockCard height={latest?.data?.blockFinalized?.height} />;
 * }
 * ```
 *
 * @example For `VerifyOnly` subgroves (validator has no data):
 * ```tsx
 * const { latest } = useSubscription(sg, query, { source: 'indexer' });
 * ```
 *
 * @param subgroveId - The subgrove to subscribe to. `null` skips opening.
 * @param query - GraphQL subscription document. `null` skips opening.
 * @param options - Source selection, variables, skip flag, reconnect
 *   behavior, etc.
 */
export function useSubscription(
  subgroveId: string | null,
  query: string | null,
  options: UseSubscriptionOptions = {},
): UseSubscriptionResult {
  const { client } = useWillow();
  const [latest, setLatest] = useState<UseSubscriptionPayload | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<unknown | undefined>();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const unsubscribeRef = useRef<UnsubscribeFn | null>(null);

  // Stash the latest `onPayload` and `onReconnect` in refs so we can
  // change callbacks between renders without tearing down the
  // subscription. The WS is effectively keyed on
  // subgroveId/query/source/variables/operationName/reconnect-knobs.
  const onPayloadRef = useRef(options.onPayload);
  const onReconnectRef = useRef(options.onReconnect);
  useEffect(() => {
    onPayloadRef.current = options.onPayload;
  }, [options.onPayload]);
  useEffect(() => {
    onReconnectRef.current = options.onReconnect;
  }, [options.onReconnect]);

  // Serialize variables for the effect dependency — SWR does the same
  // in useQuery. A reference change on an identical-looking object
  // would otherwise churn the subscription.
  const variablesKey = options.variables ? JSON.stringify(options.variables) : '';
  const source: SubscribeSource = options.source ?? 'validator';
  const skip = options.skip ?? false;
  const reconnect = options.reconnect ?? true;
  const maxReconnectAttempts = options.maxReconnectAttempts;
  const reconnectBackoffMs = options.reconnectBackoffMs;
  const maxReconnectBackoffMs = options.maxReconnectBackoffMs;

  useEffect(() => {
    // Reset state on each re-open. Preserves the ergonomic "loading until
    // first payload" UX; if you want persistence across re-subscribes,
    // lift `latest` into a parent component.
    setLatest(undefined);
    setError(undefined);
    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectAttempt(0);

    if (!client || !subgroveId || !query || skip) {
      return;
    }

    const subOptions: SubscribeOptions = {
      source,
      variables: options.variables,
      operationName: options.operationName,
      connectionPayload: options.connectionPayload,
      reconnect,
      maxReconnectAttempts,
      reconnectBackoffMs,
      maxReconnectBackoffMs,
      onError: (err) => {
        setError(err);
        setIsConnected(false);
      },
      onComplete: () => {
        // Definitive end: server `complete`, reconnect gave up, or
        // reconnect was disabled and the socket dropped. In every case
        // the subscription is over for real.
        setIsConnected(false);
        setIsReconnecting(false);
        setReconnectAttempt(0);
      },
      onReconnect: (attempt, delayMs) => {
        // A drop happened and the SDK is about to retry. Flip the UI
        // to the "reconnecting" state; the next `onNext` will flip
        // `isReconnecting` back to `false`.
        setIsConnected(false);
        setIsReconnecting(true);
        setReconnectAttempt(attempt);
        onReconnectRef.current?.(attempt, delayMs);
      },
    };

    const unsub = client.subscriptions.subscribe(
      subgroveId,
      query,
      (payload) => {
        setLatest(payload);
        setIsConnected(true);
        setIsReconnecting(false);
        setReconnectAttempt(0);
        onPayloadRef.current?.(payload);
      },
      subOptions,
    );
    unsubscribeRef.current = unsub;

    return () => {
      try {
        unsub();
      } catch {
        // ignore — unsubscribe is best-effort
      }
      unsubscribeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    subgroveId,
    query,
    source,
    variablesKey,
    options.operationName,
    skip,
    reconnect,
    maxReconnectAttempts,
    reconnectBackoffMs,
    maxReconnectBackoffMs,
  ]);

  const unsubscribe = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectAttempt(0);
  };

  return {
    latest,
    isConnected,
    error,
    isReconnecting,
    reconnectAttempt,
    unsubscribe,
  };
}
