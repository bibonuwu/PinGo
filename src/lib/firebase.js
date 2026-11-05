import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Конфигурация веб-приложения Firebase. Эти ключи не секретные: доступ к данным ограничивают
// авторизация и правила безопасности (firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyDprKOSixXsJOwNRHwwt_Sas1udEqH2Uk4',
  authDomain: 'pingo-fc851.firebaseapp.com',
  projectId: 'pingo-fc851',
  storageBucket: 'pingo-fc851.firebasestorage.app',
  messagingSenderId: '64879160603',
  appId: '1:64879160603:web:9d87c6723bc287da3277be',
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.languageCode = 'ru'; // письма (сброс пароля) и окно входа Google — на русском

// Кэш Firestore в IndexedDB: приложение открывается без интернета и сразу показывает последние данные.
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
