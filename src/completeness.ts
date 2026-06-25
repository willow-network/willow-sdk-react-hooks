import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";

/**
 * Client-side completeness verification.
 *
 * Mirrors Willow's on-chain `canonical_event_set_hash`
 * (willow-network::data_sources / consensus full-block auth) so a client can
 * confirm that an indexer's served completeness data for a (subgrove, block) is
 * the complete, untampered, filter-matched event set the chain attests to —
 * without trusting the indexer.
 *
 * The trusted anchor is the on-chain `events_commitment`: a 32-byte keccak-256
 * hash the validators derive from the proven receipts. The indexer serves the
 * matched-log preimage; the client re-hashes it here and compares against the
 * anchor. A match proves the served set is exactly the chain's set.
 *
 * The hash is Ethereum keccak-256 (NOT NIST SHA3-256) — `keccak_256` from
 * `@noble/hashes/sha3`, matching the rest of the SDK.
 */

/** A single filter-matched event log, in the canonical commitment form. */
export interface Log {
  /** Contract address, exactly 20 bytes. */
  address: Uint8Array;
  /** Indexed topics, each exactly 32 bytes (topic0 = event signature hash). */
  topics: Uint8Array[];
  /** ABI-encoded non-indexed event data, raw bytes (may be empty). */
  data: Uint8Array;
}

const DOMAIN_TAG = "WILLOW_CRYPTO_EVENTS_V1";
const ADDRESS_LEN = 20;
const TOPIC_LEN = 32;
export const COMMITMENT_LEN = 32;

/** u64 big-endian (8 bytes). Uses BigInt so values above 2^53 are exact. */
function u64BE(value: number | bigint): Uint8Array {
  let v = BigInt(value);
  if (v < 0n || v > 0xffffffffffffffffn) {
    throw new RangeError(`u64 out of range: ${value}`);
  }
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** u32 big-endian (4 bytes). */
function u32BE(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`u32 out of range: ${value}`);
  }
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Constant-time-ish equality for two byte arrays of equal length. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Domain-separated keccak-256 commitment over the filter-matched event set in
 * canonical order. Binds only `(address, topics, data)` — the consensus-
 * derivable, root-bound fields — length-prefixed so no boundary is ambiguous.
 *
 * Preimage (all integers big-endian, no separators):
 *   - "WILLOW_CRYPTO_EVENTS_V1"      (23 ASCII bytes)
 *   - blockNumber                    (u64 BE, 8 bytes)
 *   - matchedLogs.length             (u64 BE, 8 bytes)
 *   - per log, in order:
 *       - address                    (20 bytes)
 *       - topics.length              (u32 BE, 4 bytes)
 *       - each topic                 (32 bytes)
 *       - data.length                (u32 BE, 4 bytes)
 *       - data                       (raw bytes)
 *
 * @returns the 32-byte commitment.
 */
export function canonicalEventSetHash(
  blockNumber: number | bigint,
  matchedLogs: Log[],
): Uint8Array {
  const parts: Uint8Array[] = [
    utf8ToBytes(DOMAIN_TAG),
    u64BE(blockNumber),
    u64BE(matchedLogs.length),
  ];

  for (const log of matchedLogs) {
    if (log.address.length !== ADDRESS_LEN) {
      throw new RangeError(
        `log address must be ${ADDRESS_LEN} bytes, got ${log.address.length}`,
      );
    }
    parts.push(log.address);
    parts.push(u32BE(log.topics.length));
    for (const topic of log.topics) {
      if (topic.length !== TOPIC_LEN) {
        throw new RangeError(
          `topic must be ${TOPIC_LEN} bytes, got ${topic.length}`,
        );
      }
      parts.push(topic);
    }
    parts.push(u32BE(log.data.length));
    parts.push(log.data);
  }

  return keccak_256(concatBytes(parts));
}

/**
 * Verify an indexer's served matched-log set against the trusted on-chain
 * commitment: returns true iff re-hashing the served set yields the anchor.
 *
 * @param commitment   the 32-byte on-chain `events_commitment` anchor.
 * @param blockNumber  the block the set belongs to.
 * @param matchedLogs  the indexer-served filter-matched logs.
 */
export function verifyServedEvents(
  commitment: Uint8Array,
  blockNumber: number | bigint,
  matchedLogs: Log[],
): boolean {
  if (commitment.length !== COMMITMENT_LEN) return false;
  return bytesEqual(
    canonicalEventSetHash(blockNumber, matchedLogs),
    commitment,
  );
}
