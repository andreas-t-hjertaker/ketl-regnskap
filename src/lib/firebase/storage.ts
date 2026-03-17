import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  type UploadMetadata,
} from "firebase/storage";
import { app } from "./config";

export const storage = getStorage(app);

export async function uploadFile(
  path: string,
  file: File | Blob,
  metadata?: UploadMetadata
) {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, metadata);
  const url = await getDownloadURL(snapshot.ref);
  return { url, path: snapshot.ref.fullPath };
}

export function uploadFileWithProgress(
  path: string,
  file: File | Blob,
  onProgress?: (percent: number) => void,
  metadata?: UploadMetadata
) {
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, metadata);

  return new Promise<{ url: string; path: string }>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path: task.snapshot.ref.fullPath });
      }
    );
  });
}

export async function getFileURL(path: string) {
  return getDownloadURL(ref(storage, path));
}

export async function deleteFile(path: string) {
  return deleteObject(ref(storage, path));
}

export async function listFiles(path: string) {
  const listRef = ref(storage, path);
  const result = await listAll(listRef);
  return Promise.all(
    result.items.map(async (item) => ({
      name: item.name,
      path: item.fullPath,
      url: await getDownloadURL(item),
    }))
  );
}

export { ref, storage as storageInstance };
