import { signEd25519, signSecp256k1 } from '@willow-network/sdk';
import type {
  FileOperations,
  SignatureAlgorithm,
  SignFunction,
  Signer,
  WillowClient,
} from '@willow-network/sdk';

/** The signing options `client.files` takes for the transactions it sends. */
export type FileSigningOptions = NonNullable<Parameters<FileOperations['upload']>[5]>;

/** The client's identity and the function that signs as it. */
export interface IdentitySigner {
  did: string;
  privateKey: string;
  publicKeyId: string;
  algorithm: SignatureAlgorithm;
  signFunction: SignFunction;
}

/**
 * The client's identity, with the sign function of its own algorithm, or
 * `null` without an identity.
 *
 * The algorithm is the one `client.auth` signs requests with: the one passed
 * to `setIdentity`, the key type of the DID document `client.init` resolved,
 * or else the one the DID and the key's form imply. `client.auth` encodes a request
 * signature as the API decodes `X-Signature`, Ed25519 as plain hex and
 * secp256k1 as `0x`-prefixed hex, so one signed header says which it is.
 */
export function identitySigner(client: WillowClient | null): IdentitySigner | null {
  if (!client || !client.auth.hasIdentity()) return null;
  const did = client.auth.getDid()!;
  const privateKey = client.auth.getPrivateKey()!;
  const publicKeyId = client.auth.getPublicKeyId()!;
  const probe = client.auth.signRequest('GET', '/')['X-Signature'];
  const algorithm: SignatureAlgorithm = probe.startsWith('0x') ? 'secp256k1' : 'Ed25519';
  return {
    did,
    privateKey,
    publicKeyId,
    algorithm,
    signFunction: algorithm === 'secp256k1' ? signSecp256k1 : signEd25519,
  };
}

/** {@link identitySigner}, throwing `Not authenticated` without an identity. */
export function requireIdentitySigner(client: WillowClient | null): IdentitySigner {
  const signer = identitySigner(client);
  if (!signer) throw new Error('Not authenticated');
  return signer;
}

/** The consensus {@link Signer} for an identity: its key and its own sign function. */
export function consensusSigner(signer: IdentitySigner): Signer {
  return {
    privateKey: signer.privateKey,
    publicKeyId: signer.publicKeyId,
    signFunction: signer.signFunction,
  };
}

/**
 * The nonce for a DID's next transaction: one above its account's base nonce
 * (`GET /account/:did/nonce`). A nonce is a u64 and a JS number is exact only
 * up to 2^53 - 1, so a larger one is refused rather than rounded.
 */
export async function nextNonce(
  client: WillowClient,
  apiUrl: string,
  did: string,
): Promise<number> {
  const response = await fetch(
    `${apiUrl.replace(/\/+$/, '')}/account/${encodeURIComponent(did)}/nonce`,
    { headers: client.auth.apiKeyHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch the nonce of ${did}: HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    success?: boolean;
    data?: { nonce?: unknown };
    error?: string;
  };
  const base = body.data?.nonce;
  if (!body.success || typeof base !== 'number' || !Number.isSafeInteger(base) || base < 0) {
    throw new Error(
      `Failed to fetch the nonce of ${did}: ${body.error ?? `unexpected nonce ${String(base)}`}`,
    );
  }
  const next = base + 1;
  if (!Number.isSafeInteger(next)) {
    throw new Error(`The next nonce of ${did} is above 2^53 - 1, which a JS number can't hold exactly`);
  }
  return next;
}

/**
 * The signing options for a file transaction sent as `signer`: its DID as
 * the owner, its key and sign function, and its next nonce.
 */
export async function fileSigningOptions(
  client: WillowClient,
  apiUrl: string,
  signer: IdentitySigner,
): Promise<FileSigningOptions> {
  return {
    ownerDid: signer.did,
    privateKey: signer.privateKey,
    publicKeyId: signer.publicKeyId,
    signFunction: signer.signFunction,
    nonce: await nextNonce(client, apiUrl, signer.did),
  };
}
