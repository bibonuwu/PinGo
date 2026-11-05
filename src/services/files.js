import { Bytes, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { batch, commit, friendlyError } from '../lib/remote';
import { fmtBytes, uid } from '../lib/utils';
import { t } from '../i18n';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_FILES = 5;
export const ACCEPTED_FILES = 'image/png,image/jpeg,image/webp,application/pdf';

// Документы (диплом, сертификаты) хранятся в самой Firestore — Firebase Storage работает только
// на платном тарифе Blaze, а Firestore входит в бесплатный Spark. Документ Firestore вмещает до 1 МБ,
// поэтому файл режется на части: documents/{ownerId}/parts/{fileId}_{n}. Открыть их могут только
// владелец и модератор (firestore.rules). В анкете хранится только описание файла.
const PART_SIZE = 750 * 1024;
// Фото до 20 МБ принимаем: перед загрузкой оно уменьшится.
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const IMAGE_MAX_SIDE = 2000;

const partRef = (ownerId, fileId, n) => doc(firestore, 'documents', ownerId, 'parts', `${fileId}_${n}`);

// Фото документа с телефона весит 3–8 МБ. Уменьшаем до 2000 px по длинной стороне (JPEG): текст
// остаётся читаемым, а в базе файл занимает в 5–10 раз меньше места.
async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.size <= PART_SIZE) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // прозрачный фон PNG в JPEG стал бы чёрным
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // браузер не смог прочитать картинку — загружаем как есть
  }
}

export async function saveFiles(ownerId, fileList, alreadyAttached = 0) {
  const files = [...fileList];
  if (alreadyAttached + files.length > MAX_FILES) throw new Error(t('Можно прикрепить не больше {MAX_FILES} файлов', { MAX_FILES }));
  for (const f of files) {
    if (!ACCEPTED_FILES.split(',').includes(f.type)) throw new Error(t('«{name}»: нужен PDF, JPG, PNG или WebP', { name: f.name }));
    const limit = f.type.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (f.size > limit) throw new Error(t('«{name}» больше {fmtBytes}', { name: f.name, fmtBytes: fmtBytes(limit) }));
  }
  const metas = [];
  for (const f of files) {
    const blob = await shrinkImage(f);
    if (blob.size > MAX_FILE_SIZE) throw new Error(t('«{name}» больше {fmtBytes}', { name: f.name, fmtBytes: fmtBytes(MAX_FILE_SIZE) }));
    const data = new Uint8Array(await blob.arrayBuffer());
    const id = uid();
    const parts = Math.max(1, Math.ceil(data.length / PART_SIZE));
    const w = batch();
    for (let n = 0; n < parts; n += 1) {
      w.set(partRef(ownerId, id, n), {
        fileId: id,
        index: n,
        total: parts,
        chunk: Bytes.fromUint8Array(data.subarray(n * PART_SIZE, (n + 1) * PART_SIZE)),
      });
    }
    await commit(w);
    metas.push({ id, ownerId, name: f.name, type: blob.type || f.type, size: data.length, parts });
  }
  return metas;
}

export async function deleteFile(meta) {
  // У файлов из Firebase Storage (старая версия) нет частей в Firestore — удалять здесь нечего.
  if (!meta?.parts) return;
  const w = batch();
  for (let n = 0; n < meta.parts; n += 1) w.delete(partRef(meta.ownerId, meta.id, n));
  await commit(w);
}

export async function openFile(meta) {
  // Вкладку открываем сразу, до сетевого запроса, — иначе браузер посчитает её всплывающим окном.
  const tab = window.open('', '_blank');
  try {
    if (!meta?.parts) {
      throw new Error(meta?.path ? t('Файл загружен в старое хранилище — удалите его и прикрепите заново.') : t('Файл не найден'));
    }
    const snaps = await Promise.all(
      Array.from({ length: meta.parts }, (_, n) => getDoc(partRef(meta.ownerId, meta.id, n))),
    ).catch((e) => {
      throw friendlyError(e);
    });
    if (snaps.some((s) => !s.exists())) throw new Error(t('Файл не найден — возможно, его удалили.'));
    const blob = new Blob(
      snaps.map((s) => s.data().chunk.toUint8Array()),
      { type: meta.type },
    );
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch (e) {
    tab?.close();
    throw e;
  }
}
