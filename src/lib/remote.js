import { doc, writeBatch } from 'firebase/firestore';
import { firestore } from './firebase';

// Запись в Firestore. Сервисы собирают все изменения одного действия в пакет (writeBatch) —
// он применяется целиком или не применяется вовсе.

export const ref = (collectionName, id) => doc(firestore, collectionName, id);
export const batch = () => writeBatch(firestore);

const MESSAGES = {
  'permission-denied': 'Недостаточно прав для этого действия. Обновите страницу и попробуйте ещё раз.',
  unavailable: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  'deadline-exceeded': 'Сервер долго не отвечает. Попробуйте ещё раз.',
  'resource-exhausted': 'Слишком много запросов. Подождите немного и попробуйте снова.',
  'not-found': 'Запись не найдена — возможно, её уже удалили.',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/wrong-password': 'Неверный email или пароль',
  'auth/user-not-found': 'Неверный email или пароль',
  'auth/invalid-email': 'Проверьте адрес электронной почты',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован — попробуйте войти',
  'auth/weak-password': 'Пароль слишком простой — минимум 6 символов',
  'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут и попробуйте снова.',
  'auth/network-request-failed': 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  'auth/popup-blocked': 'Браузер заблокировал окно входа. Разрешите всплывающие окна для сайта.',
  'auth/popup-closed-by-user': 'Окно входа закрыто — попробуйте ещё раз.',
  'auth/cancelled-popup-request': 'Окно входа закрыто — попробуйте ещё раз.',
  'auth/account-exists-with-different-credential': 'Этот email уже зарегистрирован с паролем — войдите по email.',
  'auth/unauthorized-domain': 'Вход через Google не разрешён для этого адреса сайта. Добавьте домен в настройках Firebase Authentication.',
  'auth/operation-not-allowed': 'Этот способ входа отключён в настройках Firebase Authentication.',
  'auth/requires-recent-login': 'Для этого действия войдите в аккаунт заново.',
  'auth/user-disabled': 'Аккаунт заблокирован. Напишите в поддержку Pingo.',
};

// Понятное сообщение вместо «FirebaseError: Missing or insufficient permissions».
export function friendlyError(e) {
  const text = MESSAGES[e?.code];
  if (!text) return e;
  console.warn(e);
  const err = new Error(text);
  err.code = e.code;
  err.cause = e;
  return err;
}

export async function commit(b) {
  try {
    await b.commit();
  } catch (e) {
    throw friendlyError(e);
  }
}

export const update = (collectionName, id, patch) => commit(batch().update(ref(collectionName, id), patch));

// Пакет Firestore вмещает не больше 500 операций — длинные списки пишем частями.
export async function commitEach(items, add, size = 400) {
  for (let i = 0; i < items.length; i += size) {
    const b = batch();
    for (const item of items.slice(i, i + size)) add(b, item);
    await commit(b);
  }
}
