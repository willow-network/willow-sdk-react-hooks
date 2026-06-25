import {
  canonicalEventSetHash,
  verifyServedEvents,
  Log,
} from "../src/completeness";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** N bytes all set to `byte`. */
function rep(byte: number, n: number): Uint8Array {
  return new Uint8Array(n).fill(byte);
}

/** Parse a `0x…` hex string into bytes. */
function hex(s: string): Uint8Array {
  const h = s.startsWith("0x") ? s.slice(2) : s;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Cross-language correctness gate: these vectors are authoritative and must
// match willow-network::canonical_event_set_hash byte-for-byte. A mismatch
// means the byte layout or endianness is wrong — fix the impl, not the vector.
const VECTOR_A =
  "0x52089e4c924fbab0475d310d7f74bf8cae542d006a45d3c5d94adacda6937da5";
const VECTOR_B =
  "0xe1544ae919458663e8fce14bdcd06df6a777410c068302c0584dff1587524dfd";

// Vector B's matched-log set.
function vectorBLogs(): Log[] {
  return [
    {
      address: rep(0x42, 20),
      topics: [rep(0xdd, 32), rep(0x11, 32)],
      data: hex("0x01020304"),
    },
    {
      address: rep(0x43, 20),
      topics: [rep(0xaa, 32)],
      data: new Uint8Array(0),
    },
  ];
}

// ---------------------------------------------------------------------------
// canonicalEventSetHash — authoritative vectors
// ---------------------------------------------------------------------------

describe("canonicalEventSetHash", () => {
  it("matches vector A (empty set, block 0)", () => {
    const got = canonicalEventSetHash(0, []);
    expect(toHex(got)).toBe(VECTOR_A);
  });

  it("matches vector B (two logs, block 7)", () => {
    const got = canonicalEventSetHash(7, vectorBLogs());
    expect(toHex(got)).toBe(VECTOR_B);
  });

  it("is deterministic", () => {
    const a = canonicalEventSetHash(7, vectorBLogs());
    const b = canonicalEventSetHash(7, vectorBLogs());
    expect(toHex(a)).toBe(toHex(b));
  });

  it("accepts bigint block numbers (exact above 2^53)", () => {
    const big = 0xffffffffffffffffn;
    expect(() => canonicalEventSetHash(big, [])).not.toThrow();
  });

  it("rejects malformed addresses and topics", () => {
    expect(() =>
      canonicalEventSetHash(1, [
        { address: rep(0x42, 19), topics: [], data: new Uint8Array(0) },
      ]),
    ).toThrow();
    expect(() =>
      canonicalEventSetHash(1, [
        {
          address: rep(0x42, 20),
          topics: [rep(0xdd, 31)],
          data: new Uint8Array(0),
        },
      ]),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// verifyServedEvents — accept + tamper rejection
// ---------------------------------------------------------------------------

describe("verifyServedEvents", () => {
  it("accepts the honest served set (vector A)", () => {
    expect(verifyServedEvents(hex(VECTOR_A), 0, [])).toBe(true);
  });

  it("accepts the honest served set (vector B)", () => {
    expect(verifyServedEvents(hex(VECTOR_B), 7, vectorBLogs())).toBe(true);
  });

  it("rejects a changed block number", () => {
    expect(verifyServedEvents(hex(VECTOR_B), 8, vectorBLogs())).toBe(false);
  });

  it("rejects a dropped log", () => {
    const dropped = vectorBLogs().slice(0, 1);
    expect(verifyServedEvents(hex(VECTOR_B), 7, dropped)).toBe(false);
  });

  it("rejects an added log", () => {
    const added = [
      ...vectorBLogs(),
      { address: rep(0x44, 20), topics: [], data: new Uint8Array(0) },
    ];
    expect(verifyServedEvents(hex(VECTOR_B), 7, added)).toBe(false);
  });

  it("rejects a flipped topic byte", () => {
    const tampered = vectorBLogs();
    tampered[0].topics[0] = rep(0xde, 32);
    expect(verifyServedEvents(hex(VECTOR_B), 7, tampered)).toBe(false);
  });

  it("rejects mutated data", () => {
    const tampered = vectorBLogs();
    tampered[0].data = hex("0x010203ff");
    expect(verifyServedEvents(hex(VECTOR_B), 7, tampered)).toBe(false);
  });

  it("rejects a non-32-byte commitment", () => {
    expect(verifyServedEvents(rep(0x00, 31), 0, [])).toBe(false);
  });
});
