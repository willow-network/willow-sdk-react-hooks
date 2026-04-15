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
}

export interface UseSubscriptionResult {
  /** Most recent payload the hook has received, or `undefined` if none yet. */
  latest: UseSubscriptionPayload | undefined;
  /**
   * Whether the subscription is currently believed to be open. Flips
   * to `false` when the socket closes (server sent `complete`, the
   * connection dropped, or the caller unsubscribed).
   */
  isConnected: boolean;
  /** Error from the transport or a GraphQL-protocol error. */
  error: unknown | undefined;
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
 * @example
 * ```tsx
 * function BlockStream({ subgroveId }: { subgroveId: string }) {
 *   const { latest, isConnected, error } = useSubscription(
 *     subgroveId,
 *     'subscription { blockFinalized { height appHash } }',
 *   );
 *
 *   if (error) return <ErrorView err={error} />;
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
 * @param options - Source selection, variables, skip flag, etc.
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
  const unsubscribeRef = useRef<UnsubscribeFn | null>(null);

  // Stash the latest `onPayload` in a ref so we can change callbacks
  // between renders without forcing the subscription to be torn down
  // and re-established. The WS is effectively keyed on
  // subgroveId/query/source/variables/operationName only.
  const onPayloadRef = useRef(options.onPayload);
  useEffect(() => {
    onPayloadRef.current = options.onPayload;
  }, [options.onPayload]);

  // Serialize variables for the effect dependency — SWR does the same
  // in useQuery. A reference change on an identical-looking object
  // would otherwise churn the subscription.
  const variablesKey = options.variables ? JSON.stringify(options.variables) : '';
  const source: SubscribeSource = options.source ?? 'validator';
  const skip = options.skip ?? false;

  useEffect(() => {
    // Reset state on each re-open. Preserves the ergonomic "loading until
    // first payload" UX; if you want persistence across re-subscribes,
    // lift `latest` into a parent component.
    setLatest(undefined);
    setError(undefined);
    setIsConnected(false);

    if (!client || !subgroveId || !query || skip) {
      return;
    }

    const subOptions: SubscribeOptions = {
      source,
      variables: options.variables,
      operationName: options.operationName,
      connectionPayload: options.connectionPayload,
      onError: (err) => {
        setError(err);
        setIsConnected(false);
      },
      onComplete: () => setIsConnected(false),
    };

    const unsub = client.subscriptions.subscribe(
      subgroveId,
      query,
      (payload) => {
        setLatest(payload);
        setIsConnected(true);
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
  ]);

  const unsubscribe = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setIsConnected(false);
  };

  return { latest, isConnected, error, unsubscribe };
}
