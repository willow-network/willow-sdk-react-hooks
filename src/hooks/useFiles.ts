import { useCallback } from 'react';
import useSWR, { mutate, SWRConfiguration } from 'swr';
import { useWillow } from './useWillow';

interface FileManifest {
  file_key: string;
  filename: string;
  content_type: string;
  total_size: number;
  content_hash: string;
  chunk_count: number;
  chunk_size: number;
  chunk_merkle_root: string;
  owner_did: string;
  created_at: number;
  updated_at: number;
  encrypted: boolean;
  storage_nodes: string[];
}

interface UseFilesOptions extends SWRConfiguration {
  suspense?: boolean;
}

/**
 * Hook for listing files in a subgrove.
 */
export function useFiles(
  subgroveId: string,
  options?: UseFilesOptions,
) {
  const { client } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client) return null;
    return client.files.list(subgroveId);
  }, [client, subgroveId]);

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: swrMutate,
  } = useSWR(
    client ? ['files', subgroveId] : null,
    fetcher,
    { revalidateOnFocus: false, ...options },
  );

  const refetch = useCallback(() => swrMutate(), [swrMutate]);

  return { files: data ?? [], error, isLoading, isValidating, refetch };
}

/**
 * Hook for getting a single file's metadata.
 */
export function useFileMetadata(
  subgroveId: string,
  fileKey: string | null,
  options?: UseFilesOptions,
) {
  const { client } = useWillow();

  const fetcher = useCallback(async () => {
    if (!client || !fileKey) return null;
    return client.files.metadata(subgroveId, fileKey);
  }, [client, subgroveId, fileKey]);

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: swrMutate,
  } = useSWR(
    client && fileKey ? ['file-metadata', subgroveId, fileKey] : null,
    fetcher,
    { revalidateOnFocus: false, ...options },
  );

  const refetch = useCallback(() => swrMutate(), [swrMutate]);

  return { metadata: data ?? null, error, isLoading, isValidating, refetch };
}

/**
 * Hook for file upload/download/delete mutations.
 */
export function useFileMutations(subgroveId: string) {
  const { client, isAuthenticated } = useWillow();

  const upload = useCallback(
    async (
      fileKey: string,
      filename: string,
      data: Buffer,
      storageNodeEndpoint: string,
    ): Promise<FileManifest> => {
      if (!client || !isAuthenticated) {
        throw new Error('Not authenticated');
      }
      const manifest = await client.files.upload(
        subgroveId,
        fileKey,
        filename,
        data,
        storageNodeEndpoint,
      );
      // Invalidate file list cache
      await mutate(['files', subgroveId]);
      return manifest;
    },
    [client, isAuthenticated, subgroveId],
  );

  const download = useCallback(
    async (fileKey: string, storageNodeEndpoint: string): Promise<Uint8Array> => {
      if (!client) throw new Error('Client not initialized');
      return client.files.download(
        subgroveId,
        fileKey,
        storageNodeEndpoint,
      );
    },
    [client, subgroveId],
  );

  const deleteFile = useCallback(
    async (fileKey: string): Promise<void> => {
      if (!client || !isAuthenticated) {
        throw new Error('Not authenticated');
      }
      await client.files.delete(subgroveId, fileKey);
      // Invalidate caches
      await mutate(['files', subgroveId]);
      await mutate(['file-metadata', subgroveId, fileKey]);
    },
    [client, isAuthenticated, subgroveId],
  );

  return { upload, download, deleteFile };
}

/**
 * Hook for unregistering a storage node.
 */
export function useUnregisterStorageNode() {
  const { client, isAuthenticated } = useWillow();

  const unregisterStorageNode = useCallback(
    async (nodeDid: string): Promise<void> => {
      if (!client || !isAuthenticated) {
        throw new Error('Not authenticated');
      }
      await client.files.unregisterStorageNode(nodeDid);
    },
    [client, isAuthenticated],
  );

  return { unregisterStorageNode };
}
