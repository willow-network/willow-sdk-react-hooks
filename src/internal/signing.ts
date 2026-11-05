import { PrivacyOperations } from '@willow-network/sdk';
import type { FileOperations, Signer, WillowClient } from '@willow-network/sdk';

/** The signing options `client.files` takes for the transactions it sends. */
export type FileSigningOptions = NonNullable<Parameters<FileOperations['upload']>[5]>;

/** The client's identity and the SDK's transaction signer for it. */
export interface IdentitySigner {
  did: string;
  privateKey: string;
  publicKeyId: string;
  signer: Required<Signer>;
}

/**
 * The client's identity with the SDK's own transaction signer
 * (`client.auth.transactionSigner()`), which signs with the identity's
 * algorithm and refuses a secp256k1 algorithm guessed from the key's form
 * (`ALGORITHM_REQUIRED`). Throws `Not authenticated` without an identity.
 */
export function requireIdentitySigner(client: WillowClient | null): IdentitySigner {
  if (!client || !client.auth.hasIdentity()) throw new Error('Not authenticated');
  const signer = client.auth.transactionSigner();
  return {
    did: client.auth.getDid()!,
    privateKey: signer.privateKey,
    publicKeyId: signer.publicKeyId,
    signer,
  };
}

/**
 * The signing options for a file transaction sent as `signer`: its DID as the
 * owner and its key and sign function. No nonce: `client.files` takes the
 * lowest free one from the client's nonce allocator, as every write does.
 */
export function fileSigningOptions(signer: IdentitySigner): FileSigningOptions {
  return {
    ownerDid: signer.did,
    privateKey: signer.privateKey,
    publicKeyId: signer.publicKeyId,
    signFunction: signer.signer.signFunction,
  };
}

/**
 * The SDK's key-grant operations for the client's identity, signing with its
 * algorithm and taking nonces from the client's allocator. Throws
 * `Not authenticated` without an identity.
 */
export function privacyOperations(client: WillowClient | null, apiUrl: string | undefined): PrivacyOperations {
  if (!apiUrl) throw new Error('Not authenticated');
  const { privateKey, publicKeyId, signer } = requireIdentitySigner(client);
  return new PrivacyOperations(apiUrl, client!.auth, privateKey, publicKeyId, signer.signFunction, client!.consensus.nonces);
}
