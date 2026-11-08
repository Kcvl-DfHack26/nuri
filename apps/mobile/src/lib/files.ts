import { File } from 'expo-file-system';

/**
 * Deletes a file on the device if it is still there. A failure is ignored: the caller has nothing
 * to recover, and the files deleted here are cleared again later (with the post flow, or when ⑬
 * mounts).
 */
export function deleteFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Left for the later cleanup.
  }
}
