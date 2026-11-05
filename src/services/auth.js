import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { arrayRemove, arrayUnion, getDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { db } from '../lib/db';
import { batch, commit, friendlyError, ref, update } from '../lib/remote';
import { DEFAULT_A11Y, isAdminEmail } from '../lib/constants';
import { isEmail } from '../lib/utils';
import { newProfile } from './profiles';
import { t } from '../i18n';

export const MIN_PASSWORD = 6;

// Публичная карточка (people/{uid}): её видят другие участники — в каталоге, записях и чатах.
// Всё остальное (email, избранное, настройки) лежит в users/{uid} и доступно только владельцу и модератору.
export const personOf = (u) => ({ id: u.id, role: u.role, name: u.name, avatar: u.avatar ?? null, createdAt: u.createdAt });

function checkName(name) {
  const n = (name || '').trim();
  if (n.length < 2) throw new Error(t('Введите имя — минимум 2 символа'));
  if (n.length > 60) throw new Error(t('Имя слишком длинное'));
  return n;
}

// Модератор — только подтверждённая почта из ADMIN_EMAILS (то же проверяют правила Firestore).
export const isAdminAccount = (account) => !!account?.emailVerified && isAdminEmail(account.email);

async function createAccountDocs(account, { role, name }) {
  const allowed = ['parent', 'specialist'].includes(role) || (role === 'admin' && isAdminAccount(account));
  if (!allowed) throw new Error(t('Выберите, кто вы: родитель или специалист'));
  const user = {
    id: account.uid,
    role,
    name: checkName(name),
    email: (account.email || '').toLowerCase(),
    avatar: null,
    favorites: [],
    activeChildId: null,
    accessibility: { ...DEFAULT_A11Y },
    tourDone: false,
    createdAt: Date.now(),
  };
  const w = batch();
  w.set(ref('users', user.id), user);
  w.set(ref('people', user.id), personOf(user));
  if (role === 'specialist') w.set(ref('profiles', user.id), newProfile(user.id));
  await commit(w);
  return user;
}

export async function registerUser({ role, name, email, password }) {
  if (!['parent', 'specialist'].includes(role)) throw new Error(t('Выберите, кто вы: родитель или специалист'));
  const cleanName = checkName(name);
  if (!isEmail(email)) throw new Error(t('Проверьте адрес электронной почты'));
  if (password.length < MIN_PASSWORD) throw new Error(t('Пароль — минимум {MIN_PASSWORD} символов', { MIN_PASSWORD }));
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    throw friendlyError(e);
  }
  updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  // Почта модератора: админ-панель откроется после подтверждения адреса — письмо отправляем сразу.
  if (isAdminEmail(email)) sendEmailVerification(cred.user).catch(() => {});
  return createAccountDocs(cred.user, { role, name: cleanName });
}

// Почта модератора: при входе аккаунт получает роль admin (или создаётся сразу с ней).
// current — документ users/{uid} или null, если аккаунта в Pingo ещё нет.
export async function claimAdmin(account, current) {
  if (!current) {
    const name = (account.displayName || account.email.split('@')[0]).trim().slice(0, 60);
    return createAccountDocs(account, { role: 'admin', name: name.length >= 2 ? name : t('Модератор') });
  }
  const w = batch();
  w.update(ref('users', account.uid), { role: 'admin' });
  w.set(ref('people', account.uid), personOf({ ...current, id: account.uid, role: 'admin' }));
  // Модератор не ведёт занятия: убираем его анкету из каталога, чтобы к нему не записывались.
  if (current.role === 'specialist') w.delete(ref('catalog', account.uid));
  await commit(w);
  return { ...current, role: 'admin' };
}

export async function sendVerificationEmail() {
  if (!auth.currentUser) throw new Error(t('Сначала войдите в аккаунт'));
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (e) {
    throw friendlyError(e);
  }
}

// Вошли (например, через Google), но аккаунт в Pingo ещё не создан — выбрать роль и имя.
export function completeRegistration({ role, name }) {
  if (!auth.currentUser) throw new Error(t('Сначала войдите в аккаунт'));
  return createAccountDocs(auth.currentUser, { role, name });
}

export async function loginUser(email, password) {
  if (!isEmail(email)) throw new Error(t('Проверьте адрес электронной почты'));
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    throw friendlyError(e);
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    throw friendlyError(e);
  }
}

// Регистрация через Google с уже выбранной ролью. Если аккаунт в Pingo уже есть — это просто вход.
// Возвращает null, если имя из Google не подошло и его нужно ввести на форме.
export async function registerWithGoogle(role) {
  const account = await loginWithGoogle();
  const snap = await getDoc(ref('users', account.uid)).catch((e) => {
    throw friendlyError(e);
  });
  if (snap.exists()) return snap.data();
  const name = (account.displayName || '').trim();
  if (name.length < 2) return null;
  return createAccountDocs(account, { role, name: name.slice(0, 60) });
}

export async function resetPassword(email) {
  if (!isEmail(email)) throw new Error(t('Введите email, на который зарегистрирован аккаунт'));
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    // Не подсказываем, есть ли такой аккаунт.
    if (e?.code !== 'auth/user-not-found') throw friendlyError(e);
  }
}

export function logout() {
  return signOut(auth);
}

export function updateUser(id, patch) {
  return update('users', id, patch);
}

export async function updateAccount(id, { name, avatar }) {
  const patch = {};
  if (name !== undefined) patch.name = checkName(name);
  if (avatar !== undefined) patch.avatar = avatar;
  const w = batch();
  w.update(ref('users', id), patch);
  w.update(ref('people', id), patch);
  await commit(w);
}

export async function toggleFavorite(userId, specialistId) {
  const u = db.users.peek(userId);
  const add = !(u?.favorites || []).includes(specialistId);
  await updateUser(userId, { favorites: add ? arrayUnion(specialistId) : arrayRemove(specialistId) });
  return add;
}
