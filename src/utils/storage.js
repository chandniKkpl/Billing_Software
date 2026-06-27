import { get, set, del } from 'idb-keyval';

export async function saveFile(id, base64Data) {
  await set(`file_${id}`, base64Data);
}

export async function getFile(id) {
  return await get(`file_${id}`);
}

export async function deleteFile(id) {
  await del(`file_${id}`);
}
