import { useSyncExternalStore } from 'react';

// Ловим beforeinstallprompt как можно раньше (модуль импортируется в main.jsx до рендера),
// чтобы кнопка «Установить» в настройках работала в Chrome, Edge, Яндекс Браузере и на Android.
let deferredPrompt = null;
let installed = false;
const listeners = new Set();
let snapshot = null;

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', emit);
}

function getSnapshot() {
  if (!snapshot) {
    snapshot = {
      canPrompt: !!deferredPrompt,
      installed: installed || isStandalone(),
      ios: isIOS(),
    };
  }
  return snapshot;
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const e = deferredPrompt;
  deferredPrompt = null;
  emit();
  await e.prompt();
  const choice = await e.userChoice;
  if (choice?.outcome === 'accepted') installed = true;
  emit();
  return choice?.outcome || 'dismissed';
}
