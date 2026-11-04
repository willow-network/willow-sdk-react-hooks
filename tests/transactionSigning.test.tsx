import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { bytesToHex } from '@noble/hashes/utils';
import {
  deleteFileManifestSignMessage,
  getEd25519PublicKey,
  signEd25519,
  signSecp256k1,
  storeFileManifestSignMessage,
  verifyEd25519,
  verifySecp256k1,
} from '@willow-network/sdk';
import type { SignatureAlgorithm, WillowClient } from '@willow-network/sdk';
import { WillowProvider } from '../src/providers/WillowProvider';
import { useWillow } from '../src/hooks/useWillow';
import { useFileMutations, useUnregisterStorageNode } from '../src/hooks/useFiles';
import { useRegistration } from '../src/hooks/useRegistration';

// The hooks build no signed messages: @willow-network/sdk does. These check
// that each transaction the hooks send is signed as the active identity,
// with its own algorithm and its next nonce, and that without an identity
// nothing is sent.

const API_URL = 'http://localhost:3031';
const NODE_URL = 'http://storage.test';
const DID = 'did:willow:a';
const KEY_ID = 'did:willow:a#key-1';
const SEED = '03'.repeat(32);
const ED25519_PUBLIC_KEY = getEd25519PublicKey(SEED);
// The secp256k1 public key of the same seed, compressed, as in the signed
// messages' known answers.
const SECP256K1_PUBLIC_KEY = '02531fe6068134503d2723133227c867ac8fa6c83c537e9a44c3c5bdbdcb1fe337';

// The DeleteFileManifest known answer: subgrove `files-1`, key `photo.png`,
// owner `did:willow:a`, nonce 11, signed with the seed above.
const DELETE_KAT = {
  message: 'DeleteFileManifest\nSubgrove: files-1\nKey: photo.png\nOwner: did:willow:a\nNonce: 11',
  ed25519:
    '084b551d5982d0d626320efaef0bf3f01967a1a4a80cfcdc69e18b9e535be564745cdf112827847fc90307258d939b2fd76b43874d793c007e67a2725d3d2307',
  secp256k1:
    '80dfb0839e7a0c39b242a339dc1b196069c5bc4bfb18aaeb357b11f8f5b14ac17e0d0d7513c001110385869a35830f4f02cbe56b991e93af22b487ac35b7ea35',
};

/** An identity the provider's `setIdentity` takes, and how it signs. */
interface TestIdentity {
  name: string;
  args: [string, string, string] | [string, string, string, SignatureAlgorithm];
  algorithm: SignatureAlgorithm;
}

const ED25519: TestIdentity = { name: 'Ed25519', args: [DID, SEED, KEY_ID], algorithm: 'Ed25519' };
// A `0x`-prefixed 32-byte key is secp256k1, as `generateWallet` makes them.
const SECP256K1: TestIdentity = {
  name: 'secp256k1 (0x key)',
  args: [DID, `0x${SEED}`, KEY_ID],
  algorithm: 'secp256k1',
};
// An unprefixed secp256k1 key, declared through `setIdentity`'s algorithm.
const SECP256K1_DECLARED: TestIdentity = {
  name: 'secp256k1 (declared)',
  args: [DID, SEED, KEY_ID, 'secp256k1'],
  algorithm: 'secp256k1',
};

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

/** Answer the API and the storage node, with `baseNonce` as every account's base. */
function serve(baseNonce: number) {
  mockFetch.mockImplementation(async (input: string) => {
    const url = new URL(String(input));
    const nonce = url.pathname.match(/^\/account\/([^/]+)\/nonce$/);
    if (nonce) {
      return jsonResponse({
        success: true,
        data: { did: decodeURIComponent(nonce[1]), nonce: baseNonce },
        error: null,
      });
    }
    if (url.pathname === '/tx/submit') {
      return jsonResponse({ success: true, data: { tx_hash: 'AB12', code: 0, log: '' } });
    }
    if (url.origin === NODE_URL) {
      return jsonResponse({ complete: true });
    }
    return jsonResponse({ success: false, error: 'not found' }, 404);
  });
}

/** The bodies of the transactions sent to `/tx/submit`. */
function submitted(): Record<string, any>[] {
  return mockFetch.mock.calls
    .filter(([input]) => new URL(String(input)).pathname === '/tx/submit')
    .map(([, init]) => JSON.parse(init.body));
}

function verifies(identity: TestIdentity, message: string, signature: number[]): boolean {
  const hex = bytesToHex(Uint8Array.from(signature));
  return identity.algorithm === 'secp256k1'
    ? verifySecp256k1(message, `0x${hex}`, SECP256K1_PUBLIC_KEY)
    : verifyEd25519(message, hex, ED25519_PUBLIC_KEY);
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>
    <WillowProvider config={{ apiUrl: API_URL }}>{children}</WillowProvider>
  </SWRConfig>
);

/** Render `hook` under a provider, with `identity` set if one is given. */
function render<T>(hook: () => T, identity?: TestIdentity) {
  const rendered = renderHook(() => ({ willow: useWillow(), hook: hook() }), { wrapper });
  if (identity) {
    act(() => {
      (rendered.result.current.willow.setIdentity as (...a: unknown[]) => void)(...identity.args);
    });
    rendered.rerender();
  }
  const client = () => rendered.result.current.willow.client as WillowClient;
  return { ...rendered, client };
}

describe('transactions the hooks send are signed by the identity', () => {
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('the signing options reach the SDK', () => {
    it.each([ED25519, SECP256K1, SECP256K1_DECLARED])(
      'useFileMutations().upload passes the $name identity\'s key, sign function, and next nonce',
      async (identity) => {
        serve(41);
        const { result, client } = render(() => useFileMutations('files-1'), identity);
        const upload = jest.spyOn(client().files, 'upload').mockResolvedValue({} as any);
        const data = Uint8Array.from([1, 2, 3]);

        await act(async () => {
          await result.current.hook.upload('photo.png', 'photo.png', data, NODE_URL);
        });

        expect(upload).toHaveBeenCalledTimes(1);
        expect(upload).toHaveBeenCalledWith('files-1', 'photo.png', 'photo.png', data, NODE_URL, {
          ownerDid: DID,
          privateKey: identity.args[1],
          publicKeyId: KEY_ID,
          signFunction: identity.algorithm === 'secp256k1' ? signSecp256k1 : signEd25519,
          nonce: 42,
        });
        expect(mockFetch.mock.calls.map(([input]) => String(input))).toEqual([
          `${API_URL}/account/did%3Awillow%3Aa/nonce`,
        ]);
      },
    );

    it.each([ED25519, SECP256K1])(
      'useFileMutations().deleteFile passes the $name identity\'s signing options',
      async (identity) => {
        serve(10);
        const { result, client } = render(() => useFileMutations('files-1'), identity);
        const del = jest.spyOn(client().files, 'delete').mockResolvedValue();

        await act(async () => {
          await result.current.hook.deleteFile('photo.png');
        });

        expect(del).toHaveBeenCalledWith('files-1', 'photo.png', {
          ownerDid: DID,
          privateKey: identity.args[1],
          publicKeyId: KEY_ID,
          signFunction: identity.algorithm === 'secp256k1' ? signSecp256k1 : signEd25519,
          nonce: 11,
        });
      },
    );

    it.each([ED25519, SECP256K1])(
      'useUnregisterStorageNode passes the $name node identity\'s signing options',
      async (identity) => {
        serve(13);
        const { result, client } = render(() => useUnregisterStorageNode(), identity);
        const unregister = jest
          .spyOn(client().files, 'unregisterStorageNode')
          .mockResolvedValue();

        await act(async () => {
          await result.current.hook.unregisterStorageNode(DID);
        });

        expect(unregister).toHaveBeenCalledWith(DID, {
          ownerDid: DID,
          privateKey: identity.args[1],
          publicKeyId: KEY_ID,
          signFunction: identity.algorithm === 'secp256k1' ? signSecp256k1 : signEd25519,
          nonce: 14,
        });
      },
    );

    it.each([ED25519, SECP256K1])(
      'useRegistration signs registrations and deregistrations as the $name identity',
      async (identity) => {
        const { result, client } = render(() => useRegistration(), identity);
        const register = jest
          .spyOn(client().consensus, 'registerSubgrove')
          .mockResolvedValue({ success: true, txHash: 'AB12' });
        const deregister = jest
          .spyOn(client().consensus, 'deregisterSubgrove')
          .mockResolvedValue({ success: true, txHash: 'CD34' });
        const signer = {
          privateKey: identity.args[1],
          publicKeyId: KEY_ID,
          signFunction: identity.algorithm === 'secp256k1' ? signSecp256k1 : signEd25519,
        };

        await act(async () => {
          await result.current.hook.registerDataset({
            dataset_id: 'notes',
            name: 'Notes',
            schema: { version: 1, fields: {} } as any,
            owner_did: 'did:willow:someone-else',
            writers: [DID],
            readers: [],
          });
        });
        let txHash = '';
        await act(async () => {
          txHash = await result.current.hook.deregisterSubgrove('notes');
        });

        expect(register).toHaveBeenCalledWith(
          'notes',
          JSON.stringify({ version: 1, fields: {} }),
          DID,
          signer,
          {
            name: 'Notes',
            mode: { DataStorage: { name: 'Notes', writers: [DID], free_readers: [] } },
          },
        );
        expect(deregister).toHaveBeenCalledWith('notes', DID, signer);
        expect(txHash).toBe('CD34');
      },
    );

    it('useRegistration throws when the chain refuses the registration', async () => {
      const { result, client } = render(() => useRegistration(), ED25519);
      jest
        .spyOn(client().consensus, 'registerSubgrove')
        .mockResolvedValue({ success: false, errorMessage: 'subgrove exists' });

      await act(async () => {
        await expect(
          result.current.hook.registerDataset({
            dataset_id: 'notes',
            name: 'Notes',
            schema: {} as any,
            owner_did: DID,
            writers: [],
            readers: [],
          }),
        ).rejects.toThrow('registerSubgrove failed: subgrove exists');
      });
    });
  });

  describe('without an identity', () => {
    it('every hook that sends a transaction throws and sends nothing', async () => {
      serve(0);
      const files = render(() => useFileMutations('files-1'));
      const node = render(() => useUnregisterStorageNode());
      const registration = render(() => useRegistration());
      const upload = jest.spyOn(files.client().files, 'upload');
      const del = jest.spyOn(files.client().files, 'delete');
      const unregister = jest.spyOn(node.client().files, 'unregisterStorageNode');
      const register = jest.spyOn(registration.client().consensus, 'registerSubgrove');
      const deregister = jest.spyOn(registration.client().consensus, 'deregisterSubgrove');

      await act(async () => {
        await expect(
          files.result.current.hook.upload('k', 'f.txt', Uint8Array.from([1]), NODE_URL),
        ).rejects.toThrow('Not authenticated');
        await expect(files.result.current.hook.deleteFile('k')).rejects.toThrow(
          'Not authenticated',
        );
        await expect(node.result.current.hook.unregisterStorageNode(DID)).rejects.toThrow(
          'Not authenticated',
        );
        await expect(
          registration.result.current.hook.registerDataset({
            dataset_id: 'notes',
            name: 'Notes',
            schema: {} as any,
            owner_did: DID,
            writers: [],
            readers: [],
          }),
        ).rejects.toThrow('Not authenticated');
        await expect(registration.result.current.hook.deregisterSubgrove('notes')).rejects.toThrow(
          'Not authenticated',
        );
      });

      for (const spy of [upload, del, unregister, register, deregister]) {
        expect(spy).not.toHaveBeenCalled();
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('a cleared identity throws too', async () => {
      serve(0);
      const { result, client, rerender } = render(() => useFileMutations('files-1'), ED25519);
      act(() => {
        result.current.willow.clearIdentity();
      });
      rerender();
      const del = jest.spyOn(client().files, 'delete');

      await act(async () => {
        await expect(result.current.hook.deleteFile('k')).rejects.toThrow('Not authenticated');
      });
      expect(del).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('the transactions sent', () => {
    it.each([ED25519, SECP256K1, SECP256K1_DECLARED])(
      'the StoreFileManifest an upload sends verifies, as the $name identity, over the message of its own fields',
      async (identity) => {
        serve(41);
        const { result } = render(() => useFileMutations('files-1'), identity);
        const data = Uint8Array.from(Array.from({ length: 300 }, (_, i) => i % 251));

        await act(async () => {
          await result.current.hook.upload('photo.png', 'photo.png', data, NODE_URL);
        });

        const [wrapper] = submitted();
        const tx = wrapper.StoreFileManifest;
        expect(tx.owner_did).toBe(DID);
        expect(tx.public_key_id).toBe(KEY_ID);
        expect(tx.nonce).toBe(42);
        const message = storeFileManifestSignMessage({
          subgroveId: tx.subgrove_id,
          fileKey: tx.file_key,
          filename: tx.filename,
          contentType: tx.content_type,
          totalSize: tx.total_size,
          contentHash: bytesToHex(Uint8Array.from(tx.content_hash)),
          chunkCount: tx.chunk_count,
          chunkSize: tx.chunk_size,
          chunkMerkleRoot: bytesToHex(Uint8Array.from(tx.chunk_merkle_root)),
          ownerDid: tx.owner_did,
          nonce: tx.nonce,
        });
        expect(verifies(identity, message, tx.signature)).toBe(true);
        // Signed by this identity's algorithm, not the other one.
        const other = identity.algorithm === 'secp256k1' ? ED25519 : SECP256K1;
        expect(verifies(other, message, tx.signature)).toBe(false);
      },
    );

    it.each([
      { name: ED25519.name, identity: ED25519, signature: DELETE_KAT.ed25519 },
      { name: SECP256K1.name, identity: SECP256K1, signature: DELETE_KAT.secp256k1 },
    ])('deleteFile as the $name identity sends the known answer', async ({ identity, signature }) => {
      serve(10);
      const { result } = render(() => useFileMutations('files-1'), identity);

      await act(async () => {
        await result.current.hook.deleteFile('photo.png');
      });

      const [wrapper] = submitted();
      const tx = wrapper.DeleteFileManifest;
      expect(tx).toEqual({
        subgrove_id: 'files-1',
        file_key: 'photo.png',
        owner_did: DID,
        signature: tx.signature,
        public_key_id: KEY_ID,
        nonce: 11,
      });
      expect(
        deleteFileManifestSignMessage({
          subgroveId: tx.subgrove_id,
          fileKey: tx.file_key,
          ownerDid: tx.owner_did,
          nonce: tx.nonce,
        }),
      ).toBe(DELETE_KAT.message);
      expect(bytesToHex(Uint8Array.from(tx.signature))).toBe(signature);
    });

    it('the UnregisterStorageNode sent carries the node identity\'s key id, nonce, and a signature', async () => {
      serve(13);
      const { result } = render(() => useUnregisterStorageNode(), ED25519);

      await act(async () => {
        await result.current.hook.unregisterStorageNode(DID);
      });

      const [wrapper] = submitted();
      const tx = wrapper.UnregisterStorageNode;
      expect(tx.node_did).toBe(DID);
      expect(tx.public_key_id).toBe(KEY_ID);
      expect(tx.nonce).toBe(14);
      expect(tx.signature).toHaveLength(64);
    });

    it('useUnregisterStorageNode refuses an identity other than the node', async () => {
      serve(13);
      const { result } = render(() => useUnregisterStorageNode(), ED25519);

      await act(async () => {
        await expect(
          result.current.hook.unregisterStorageNode('did:willow:node'),
        ).rejects.toThrow('A storage node signs its own removal');
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([2 ** 53 - 1, 2 ** 53, 2 ** 64])(
      'a base nonce of %d, whose next nonce a JS number cannot hold exactly, is refused',
      async (base) => {
        serve(base);
        const { result } = render(() => useFileMutations('files-1'), ED25519);

        await act(async () => {
          await expect(result.current.hook.deleteFile('photo.png')).rejects.toThrow(/nonce/);
        });
        expect(submitted()).toEqual([]);
      },
    );

    it('a failed nonce fetch sends nothing', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: false, error: 'unavailable' }, 503));
      const { result } = render(() => useFileMutations('files-1'), ED25519);

      await act(async () => {
        await expect(result.current.hook.deleteFile('photo.png')).rejects.toThrow(
          'Failed to fetch the nonce of did:willow:a: HTTP 503',
        );
      });
      expect(submitted()).toEqual([]);
    });
  });
});
