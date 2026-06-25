import {
  parseMatchedLogs,
  parseAnchorCommitment,
  verifyBlockCompleteness,
  MatchedLogsResponse,
  EventsCommitmentJson,
} from "../src/completenessFetch";
import { verifyServedEvents } from "../src/completeness";

// ---------------------------------------------------------------------------
// Authoritative vector — the exact matched-logs response body from the task /
// willow PR #676. Parsing it to Log[] must re-hash to this commitment.
// ---------------------------------------------------------------------------

const COMMITMENT_HEX =
  "e1544ae919458663e8fce14bdcd06df6a777410c068302c0584dff1587524dfd";

const MATCHED_LOGS_BODY: MatchedLogsResponse = {
  subgrove_id: "sg",
  block_number: 7,
  count: 2,
  matched_logs: [
    {
      block_number: 7,
      block_hash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      transaction_hash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      transaction_index: 0,
      log_index: "0x0",
      address: "0x4242424242424242424242424242424242424242",
      topics: [
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      ],
      data: "0x01020304",
      removed: false,
    },
    {
      block_number: 7,
      block_hash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      transaction_hash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      transaction_index: 0,
      log_index: "0x1",
      address: "0x4343434343434343434343434343434343434343",
      topics: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ],
      data: "0x",
      removed: false,
    },
  ],
};

function hex(s: string): Uint8Array {
  const h = s.startsWith("0x") ? s.slice(2) : s;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

// ---------------------------------------------------------------------------
// parseMatchedLogs — gates JSON -> Log against the authoritative vector
// ---------------------------------------------------------------------------

describe("parseMatchedLogs", () => {
  it("builds Log[] that verifies against the on-chain commitment (vector B)", () => {
    const logs = parseMatchedLogs(MATCHED_LOGS_BODY);

    expect(logs).toHaveLength(2);
    expect(logs[0].address).toHaveLength(20);
    expect(logs[0].topics).toHaveLength(2);
    expect(logs[0].topics[0]).toHaveLength(32);
    expect(logs[0].data).toHaveLength(4);
    // "0x" -> empty data.
    expect(logs[1].data).toHaveLength(0);

    expect(verifyServedEvents(hex(COMMITMENT_HEX), 7, logs)).toBe(true);
  });

  it("ignores non-hashed fields (block_hash, log_index, removed, …)", () => {
    const logs = parseMatchedLogs(MATCHED_LOGS_BODY);
    // Tampering with an ignored field does not change the verified result.
    const tampered: MatchedLogsResponse = JSON.parse(
      JSON.stringify(MATCHED_LOGS_BODY),
    );
    tampered.matched_logs[0].log_index = "0xdeadbeef";
    tampered.matched_logs[0].removed = true;
    const tamperedLogs = parseMatchedLogs(tampered);
    expect(verifyServedEvents(hex(COMMITMENT_HEX), 7, tamperedLogs)).toBe(
      verifyServedEvents(hex(COMMITMENT_HEX), 7, logs),
    );
  });
});

describe("parseAnchorCommitment", () => {
  it("decodes a 64-hex events_commitment to 32 bytes", () => {
    const value: EventsCommitmentJson = {
      subgrove_id: "sg",
      block_number: 7,
      events_commitment: COMMITMENT_HEX,
    };
    expect(parseAnchorCommitment(value)).toEqual(hex(COMMITMENT_HEX));
  });

  it("rejects a wrong-length commitment", () => {
    expect(() =>
      parseAnchorCommitment({
        subgrove_id: "sg",
        block_number: 7,
        events_commitment: "abcd",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// verifyBlockCompleteness — full mocked round trip (anchor + preimage)
// ---------------------------------------------------------------------------

describe("verifyBlockCompleteness (mocked transport)", () => {
  const RPC_URL = "http://localhost:26657";
  const INDEXER_URL = "http://localhost:3051";

  function base64(json: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(json));
    return Buffer.from(bytes).toString("base64");
  }

  function jsonResponse(body: unknown, ok = true, status = 200): Response {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies true when anchor and preimage agree", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST" && url === RPC_URL) {
          // abci_query: value = base64(JSON{events_commitment}).
          return Promise.resolve(
            jsonResponse({
              result: {
                response: {
                  code: 0,
                  value: base64({
                    subgrove_id: "sg",
                    block_number: 7,
                    events_commitment: COMMITMENT_HEX,
                  }),
                },
              },
            }),
          );
        }
        if (url.includes("/completeness/sg/7/matched-logs")) {
          return Promise.resolve(jsonResponse(MATCHED_LOGS_BODY));
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      });
    (global as any).fetch = fetchMock;

    const ok = await verifyBlockCompleteness({
      rpcUrl: RPC_URL,
      indexerBaseUrl: INDEXER_URL,
      subgroveId: "sg",
      blockNumber: 7,
    });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the chain has no anchor (abci code != 0)", async () => {
    (global as any).fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === RPC_URL) {
          return Promise.resolve(
            jsonResponse({
              result: {
                response: {
                  code: 1,
                  log: "No events commitment for block 7",
                },
              },
            }),
          );
        }
        return Promise.resolve(jsonResponse(MATCHED_LOGS_BODY));
      });

    await expect(
      verifyBlockCompleteness({
        rpcUrl: RPC_URL,
        indexerBaseUrl: INDEXER_URL,
        subgroveId: "sg",
        blockNumber: 7,
      }),
    ).rejects.toThrow(/no anchor/);
  });

  it("throws when the indexer has no retained matched logs (404)", async () => {
    (global as any).fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST" && url === RPC_URL) {
          return Promise.resolve(
            jsonResponse({
              result: {
                response: {
                  code: 0,
                  value: base64({
                    subgrove_id: "sg",
                    block_number: 7,
                    events_commitment: COMMITMENT_HEX,
                  }),
                },
              },
            }),
          );
        }
        return Promise.resolve(
          jsonResponse({ error: "no retained matched logs" }, false, 404),
        );
      });

    await expect(
      verifyBlockCompleteness({
        rpcUrl: RPC_URL,
        indexerBaseUrl: INDEXER_URL,
        subgroveId: "sg",
        blockNumber: 7,
      }),
    ).rejects.toThrow(/matched-logs fetch failed/);
  });
});
