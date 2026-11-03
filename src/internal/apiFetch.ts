import { resolveRequest } from '@willow-network/sdk';
import type { WillowClient } from '@willow-network/sdk';

/**
 * How a request to the API is signed when the client has an identity:
 * - `'read'`: the nonce form, over the whole request, for reads of subgrove
 *   data (`/data`, `/proof`, `/query`, `/sql`, `/graphql`). Only this form
 *   carries the DID's read rights.
 * - `'older'`: the older `{METHOD}:{PATH}:{TIMESTAMP}` form, which proves
 *   the DID, for every other signed request.
 */
export type ApiSigning = 'read' | 'older';

export interface ApiFetchInit {
  method?: string;
  /** The exact body sent; the nonce form signs its SHA-256. */
  body?: string;
  headers?: Record<string, string>;
}

/**
 * `fetch` a path on the API, signed over the URL exactly as sent (its
 * percent-encoded path and query, less any path the API URL carries) and
 * the exact body.
 */
export function apiFetch(
  client: WillowClient,
  apiUrl: string,
  path: string,
  signing: ApiSigning,
  init: ApiFetchInit = {},
): Promise<Response> {
  const method = init.method ?? 'GET';
  const request = resolveRequest(apiUrl, path);
  const target = request?.target ?? path;
  const signature =
    signing === 'read'
      ? client.auth.getSignedHeaders(method, target, init.body)
      : client.auth.getAuthHeaders(method, target);
  return fetch(request?.href ?? `${apiUrl.replace(/\/+$/, '')}${path}`, {
    method,
    headers: { ...(init.headers ?? {}), ...signature },
    body: init.body,
  });
}
