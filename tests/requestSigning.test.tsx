import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import {
  WillowClient,
  getEd25519PublicKey,
  signedRequestMessage,
  verifyEd25519,
} from '@willow-network/sdk';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useWillow } from '../src/hooks/useWillow';
import { useKeyGrant, useKeyGrantees } from '../src/hooks/usePrivacy';
import { useGraphQLMutation } from '../src/hooks/useIndexing';
import { useValidatorSet } from '../src/hooks/useValidators';
import { apiFetch } from '../src/internal/apiFetch';

// These run the real @willow-network/sdk signer against a mocked fetch, and
// verify each request the way the API does, from what it received.

const API_URL = 'http://localhost:3031';
const DID = 'did:willow:a';
const KEY_ID = 'did:willow:a#key-1';
const SEED = '03'.repeat(32);
const PUBLIC_KEY = getEd25519PublicKey(SEED);

interface Received {
  method: string;
  url: URL;
  target: string;
  headers: Record<string, string>;
  body?: string;
}

const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function received(): Received[] {
  return mockFetch.mock.calls.map(([input, init]) => {
    const url = new URL(String(input));
    return {
      method: (init?.method as string) ?? 'GET',
      url,
      target: url.pathname + url.search,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    };
  });
}

function verifiesAsNonceSigned(req: Received, target = req.target): boolean {
  const h = req.headers;
  if (!h['X-Nonce']) return false;
  const message = signedRequestMessage(
    h['X-DID'], h['X-Public-Key-ID'], req.method, target, h['X-Timestamp'], h['X-Nonce'], req.body,
  );
  return verifyEd25519(message, h['X-Signature'], PUBLIC_KEY);
}

function verifiesAsOlderForm(req: Received, path = req.url.pathname): boolean {
  const h = req.headers;
  if (h['X-Nonce'] !== undefined) return false;
  return verifyEd25519(`${req.method}:${path}:${h['X-Timestamp']}`, h['X-Signature'], PUBLIC_KEY);
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>
    <WillowProvider config={{ apiUrl: API_URL }}>{children}</WillowProvider>
  </SWRConfig>
);

/** Render `hook` under a provider whose client has the test identity. */
function renderSigned<T>(hook: () => T) {
  const rendered = renderHook(() => ({ willow: useWillow(), hook: hook() }), { wrapper });
  act(() => {
    rendered.result.current.willow.setIdentity(DID, SEED, KEY_ID);
  });
  rendered.rerender();
  return rendered;
}

describe('request signing in the hooks', () => {
  const realFetch = global.fetch;
  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('useKeyGrant signs the encoded path it sends', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { key_epoch: 1 } }));
    const { result } = renderSigned(() => useKeyGrant('sg'));
    await waitFor(() => expect(result.current.hook.keyGrant).toEqual({ key_epoch: 1 }));

    const [req] = received();
    expect(req.url.href).toBe(`${API_URL}/key-grants/sg/did%3Awillow%3Aa`);
    // Key-grant routes take the older form, which the API checks against the
    // path it received, percent-encoded.
    expect(verifiesAsOlderForm(req)).toBe(true);
    expect(verifiesAsOlderForm(req, `/key-grants/sg/${DID}`)).toBe(false);
  });

  it('useKeyGrantees signs the path it sends', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [DID] }));
    const { result } = renderSigned(() => useKeyGrantees('my sg'));
    await waitFor(() => expect(result.current.hook.grantees).toEqual([DID]));

    const [req] = received();
    expect(req.target).toBe('/key-grants/my%20sg');
    expect(verifiesAsOlderForm(req)).toBe(true);
  });

  it('useGraphQLMutation nonce-signs the POST over its body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));
    const { result } = renderSigned(() => useGraphQLMutation('sg'));
    await act(async () => {
      await result.current.hook.execute('{ items { id } }', { first: 1 });
    });

    const [req] = received();
    expect(req.method).toBe('POST');
    expect(req.target).toBe('/graphql/sg');
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(req.body!)).toEqual({ query: '{ items { id } }', variables: { first: 1 } });
    expect(verifiesAsNonceSigned(req)).toBe(true);
    expect(verifiesAsNonceSigned({ ...req, body: '{}' })).toBe(false);
  });

  it('useGraphQLMutation sends no signature without an identity', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));
    const { result } = renderHook(() => useGraphQLMutation('sg'), { wrapper });
    await waitFor(() => expect(result.current.execute).toBeDefined());
    await act(async () => {
      await result.current.execute('{ items { id } }');
    });
    const [req] = received();
    for (const name of ['X-DID', 'X-Public-Key-ID', 'X-Signature', 'X-Timestamp', 'X-Nonce']) {
      expect(req.headers[name]).toBeUndefined();
    }
  });

  it('apiFetch signs the target the API sees behind a proxy path, with a new nonce each time', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true }));
    const client = new WillowClient({ apiUrl: 'https://proxy.example/willow' });
    client.auth.setIdentity(DID, SEED, KEY_ID, 'Ed25519');
    const init = { method: 'POST', body: '{"query":"SELECT 1"}' };
    await apiFetch(client, 'https://proxy.example/willow', '/sql/sg', 'read', init);
    await apiFetch(client, 'https://proxy.example/willow', '/sql/sg', 'read', init);

    const [a, b] = received();
    expect(a.url.href).toBe('https://proxy.example/willow/sql/sg');
    expect(verifiesAsNonceSigned(a, '/sql/sg')).toBe(true);
    expect(verifiesAsNonceSigned(b, '/sql/sg')).toBe(true);
    expect(a.headers['X-Nonce']).not.toBe(b.headers['X-Nonce']);
  });

  it('useValidatorSet reads /validators', async () => {
    // The API's answer, as the live network returns it.
    const validator = {
      did: 'did:willow:validator1',
      total_stake: 100000000000000000000000,
      self_stake: 100000000000000000000000,
      active: true,
      jailed: false,
      jail_end_time: null,
      consensus_pubkey: '7KoBf++aEL/Py579EMbPNGslpmHz40rcCSRJV937S4w=',
    };
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: [validator], error: null }));
    const { result } = renderHook(() => useValidatorSet(), { wrapper });
    await waitFor(() => expect(result.current.validators).toHaveLength(1));
    expect(received().map((r) => r.target)).toEqual(['/validators']);
    expect(result.current.validators[0]).toEqual(validator);
    expect(result.current.totalStake).toBe(1e23);
  });
});
