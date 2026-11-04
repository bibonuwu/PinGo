import { db } from '../lib/db';
import { fmtBytes, uid } from '../lib/utils';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_FILES = 5;
export const ACCEPTED_FILES = 'image/png,image/jpeg,image/webp,application/pdf';

// Документы (диплом, сертификаты) хранятся в IndexedDB как Blob.
export async function saveFiles(ownerId, fileList, alreadyAttached = 0) {
  const files = [...fileList];
  if (alreadyAttached + files.length > MAX_FILES) throw new Error(`Можно прикрепить не больше ${MAX_FILES} файлов`);
  const metas = [];
  for (const f of files) {
    if (!ACCEPTED_FILES.split(',').includes(f.type)) throw new Error(`«${f.name}»: нужен PDF, JPG, PNG или WebP`);
    if (f.size > MAX_FILE_SIZE) throw new Error(`«${f.name}» больше ${fmtBytes(MAX_FILE_SIZE)}`);
  }
  for (const f of files) {
    const meta = { id: uid(), name: f.name, type: f.type, size: f.size };
    await db.files.add({ ...meta, ownerId, blob: f, createdAt: Date.now() });
    metas.push(meta);
  }
  return metas;
}

export function getFile(id) {
  return db.files.get(id);
}

export function deleteFile(id) {
  return db.files.delete(id);
}

export async function openFile(id) {
  const f = await getFile(id);
  if (!f) throw new Error('Файл не найден');
  const url = URL.createObjectURL(f.blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
