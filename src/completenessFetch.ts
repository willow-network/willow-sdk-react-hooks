import { Log, verifyServedEvents, COMMITMENT_LEN } from "./completeness";

/**
 * End-to-end client-side completeness check.
 *
 * Builds on the pure {@link verifyServedEvents} helper by wiring up the two
 * fetches it needs:
 *
 *  1. ANCHOR  — the on-chain `events_commitment`, read from the validator via
 *     a CometBFT `abci_query` against the ABCI store path
 *     `/store/events_commitment/{subgroveId}/{blockNumber}`.
 *  2. PREIMAGE — the indexer's matched-log set, fetched from
 *     `{indexerBaseUrl}/completeness/{subgroveId}/{blockNumber}/matched-logs`.
 *
 * The served logs are re-hashed and compared to the anchor: a match proves the
 * indexer served exactly the chain's complete, untampered filter-matched set —
 * no indexer trust required.
 *
 * Both transports are plain `fetch` (the same transport every other hook in
 * this SDK uses against `config.apiUrl`). The parse/compose steps are factored
 * out as pure functions so the JSON -> Log mapping is gated by tests without a
 * live node.
 */

/** Raw `IndexedLog` shape served by the indexer's matched-logs endpoint. */
export interface IndexedLogJson {
  /** Emitting contract address, `0x` + 40 hex (20 bytes). */
  address: string;
  /** Indexed topics, each `0x` + 64 hex (32 bytes). */
  topics: string[];
  /** ABI-encoded non-indexed data, `0x`-hex (may be `"0x"`). */
  data: string;
  /** Other fields (block_number, log_index, …) are present but not hashed. */
  [extra: string]: unknown;
}

/** Body of `GET /completeness/{subgrove}/{block}/matched-logs`. */
export interface MatchedLogsResponse {
  subgrove_id: string;
  block_number: number;
  count: number;
  matched_logs: IndexedLogJson[];
}

/** JSON value an `abci_query` of the `events_commitment` store path returns. */
export interface EventsCommitmentJson {
  subgrove_id: string;
  block_number: number;
  /** keccak-256 commitment, 64 hex chars (no `0x`). */
  events_commitment: string;
}

/** Parse a `0x`-prefixed (or bare) hex string into bytes. */
function hexToBytes(input: string): Uint8Array {
  const h = input.startsWith("0x") ? input.slice(2) : input;
  if (h.length % 2 !== 0) {
    throw new Error(`hex string must have an even length, got ${h.length}`);
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(h.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`invalid hex byte at offset ${i}`);
    }
    out[i] = byte;
  }
  return out;
}

/** Decode a base64 string to bytes (works in browser and Node test env). */
function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * Build the canonical {@link Log} set from a matched-logs response body.
 *
 * Only `address`, `topics`, and `data` are read — every other field
 * (block_number, transaction_hash, log_index, removed, …) is ignored, exactly
 * as the on-chain commitment does. Throws if a hex field is malformed.
 */
export function parseMatchedLogs(body: MatchedLogsResponse): Log[] {
  return body.matched_logs.map((log) => ({
    address: hexToBytes(log.address),
    topics: log.topics.map((t) => hexToBytes(t)),
    data: hexToBytes(log.data),
  }));
}

/**
 * Decode the 32-byte commitment from the JSON value of an `events_commitment`
 * `abci_query`. Throws if the hex doesn't decode to exactly 32 bytes.
 */
export function parseAnchorCommitment(value: EventsCommitmentJson): Uint8Array {
  const bytes = hexToBytes(value.events_commitment);
  if (bytes.length !== COMMITMENT_LEN) {
    throw new Error(
      `events_commitment must be ${COMMITMENT_LEN} bytes, got ${bytes.length}`,
    );
  }
  return bytes;
}

export class CompletenessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompletenessError";
  }
}

/** Inputs for {@link verifyBlockCompleteness}. */
export interface VerifyBlockCompletenessParams {
  /** CometBFT RPC URL (the SDK's `consensusRpcUrl`) for the `abci_query`. */
  rpcUrl: string;
  /** Indexer base URL (the SDK's `indexerUrl`) for the matched-logs GET. */
  indexerBaseUrl: string;
  subgroveId: string;
  blockNumber: number | bigint;
}

/**
 * Fetch the on-chain anchor via `abci_query`, decode the JSON value, and return
 * the 32-byte commitment. Throws {@link CompletenessError} when the chain has no
 * commitment for the block (ABCI `code != 0`).
 */
export async function fetchAnchorCommitment(
  rpcUrl: string,
  subgroveId: string,
  blockNumber: number | bigint,
): Promise<Uint8Array> {
  const path = `/store/events_commitment/${subgroveId}/${blockNumber}`;
  const rpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "abci_query",
    params: { path, data: "", prove: false },
  };

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rpcRequest),
  });
  if (!resp.ok) {
    throw new CompletenessError(
      `abci_query failed: HTTP ${resp.status} ${await resp.text()}`,
    );
  }

  const json = (await resp.json()) as {
    error?: unknown;
    result?: { response?: { code?: number; log?: string; value?: string } };
  };
  if (json.error) {
    throw new CompletenessError(
      `abci_query RPC error: ${JSON.stringify(json.error)}`,
    );
  }

  const response = json.result?.response;
  if (!response || (response.code ?? 0) !== 0) {
    throw new CompletenessError(
      `no anchor for ${subgroveId} block ${blockNumber}: ${
        response?.log ?? "abci_query returned non-zero code"
      }`,
    );
  }
  if (!response.value) {
    throw new CompletenessError(
      `abci_query for ${subgroveId} block ${blockNumber} returned an empty value`,
    );
  }

  const valueBytes = base64ToBytes(response.value);
  const decoded = JSON.parse(
    new TextDecoder().decode(valueBytes),
  ) as EventsCommitmentJson;
  return parseAnchorCommitment(decoded);
}

/**
 * Fetch the indexer's matched-log preimage for a block. Throws
 * {@link CompletenessError} on a non-200 response (e.g. 404 "no retained
 * matched logs" / "block not finalized").
 */
export async function fetchMatchedLogs(
  indexerBaseUrl: string,
  subgroveId: string,
  blockNumber: number | bigint,
): Promise<Log[]> {
  const base = indexerBaseUrl.replace(/\/+$/, "");
  const url = `${base}/completeness/${encodeURIComponent(
    subgroveId,
  )}/${blockNumber}/matched-logs`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new CompletenessError(
      `matched-logs fetch failed: HTTP ${resp.status} ${await resp.text()}`,
    );
  }
  const body = (await resp.json()) as MatchedLogsResponse;
  return parseMatchedLogs(body);
}

/**
 * Run the full client-side completeness check for a `(subgrove, block)`.
 *
 * Fetches the on-chain anchor and the indexer's matched-log preimage, then
 * returns whether re-hashing the served set yields the anchor. Returns `true`
 * iff the indexer served exactly the chain's committed set.
 *
 * Throws {@link CompletenessError} when either side is unavailable (no on-chain
 * commitment yet, indexer hasn't retained the logs, block not finalized, …) —
 * "not verifiable" is distinct from "verified false".
 */
export async function verifyBlockCompleteness(
  params: VerifyBlockCompletenessParams,
): Promise<boolean> {
  const { rpcUrl, indexerBaseUrl, subgroveId, blockNumber } = params;
  const [commitment, matchedLogs] = await Promise.all([
    fetchAnchorCommitment(rpcUrl, subgroveId, blockNumber),
    fetchMatchedLogs(indexerBaseUrl, subgroveId, blockNumber),
  ]);
  return verifyServedEvents(commitment, blockNumber, matchedLogs);
}
