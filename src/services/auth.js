import { db } from '../lib/db';
import { hashPassword } from '../lib/crypto';
import { DEFAULT_A11Y } from '../lib/constants';
import { isEmail, uid } from '../lib/utils';
import { newProfile } from './profiles';

export const MIN_PASSWORD = 6;

export async function buildUser({ role, name, email, password, isDemo = false, extra = {} }) {
  const salt = uid();
  return {
    id: uid(),
    role,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    salt,
    passwordHash: await hashPassword(password, salt),
    avatar: null,
    favorites: [],
    activeChildId: null,
    accessibility: { ...DEFAULT_A11Y },
    tourDone: false,
    isDemo,
    createdAt: Date.now(),
    ...extra,
  };
}

// Администраторов нельзя зарегистрировать через сайт — их создаёт команда (здесь — сид).
export async function registerUser({ role, name, email, password }) {
  if (!['parent', 'specialist'].includes(role)) throw new Error('Выберите, кто вы: родитель или специалист');
  if (name.trim().length < 2) throw new Error('Введите имя — минимум 2 символа');
  if (!isEmail(email)) throw new Error('Проверьте адрес электронной почты');
  if (password.length < MIN_PASSWORD) throw new Error(`Пароль — минимум ${MIN_PASSWORD} символов`);
  const normalized = email.trim().toLowerCase();
  if (await db.users.where('email').equals(normalized).first()) {
    throw new Error('Этот email уже зарегистрирован — попробуйте войти');
  }
  const user = await buildUser({ role, name, email, password });
  await db.transaction('rw', db.users, db.profiles, async () => {
    await db.users.add(user);
    if (role === 'specialist') await db.profiles.add(newProfile(user.id));
  });
  return user;
}

export async function loginUser(email, password) {
  const user = await db.users.where('email').equals(email.trim().toLowerCase()).first();
  if (!user) throw new Error('Неверный email или пароль');
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('Неверный email или пароль');
  return user;
}

export function updateUser(id, patch) {
  return db.users.update(id, patch);
}

export async function updateAccount(id, { name, avatar }) {
  if (name !== undefined && name.trim().length < 2) throw new Error('Имя — минимум 2 символа');
  const patch = {};
  if (name !== undefined) patch.name = name.trim();
  if (avatar !== undefined) patch.avatar = avatar;
  await db.users.update(id, patch);
}

export async function toggleFavorite(userId, specialistId) {
  return db.transaction('rw', db.users, async () => {
    const u = await db.users.get(userId);
    const fav = new Set(u.favorites || []);
    if (fav.has(specialistId)) fav.delete(specialistId);
    else fav.add(specialistId);
    await db.users.update(userId, { favorites: [...fav] });
    return fav.has(specialistId);
  });
}
