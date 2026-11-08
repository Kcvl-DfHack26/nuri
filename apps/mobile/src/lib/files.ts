import { File } from 'expo-file-system';

/** Deletes a file on the device if it is still there. */
export function deleteFile(uri: string) {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
