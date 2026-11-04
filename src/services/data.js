import { db } from '../lib/db';
import { downloadFile, toDateKey } from '../lib/utils';
import { clearSession } from '../lib/session';

// Экспорт всех локальных данных в JSON (без паролей и файлов).
export async function exportData() {
  const out = { app: 'pingo', exportedAt: new Date().toISOString(), tables: {} };
  for (const table of db.tables) {
    if (table.name === 'files') {
      out.tables.files = (await table.toArray()).map(({ blob, ...meta }) => meta);
      continue;
    }
    const rows = await table.toArray();
    out.tables[table.name] =
      table.name === 'users' ? rows.map(({ passwordHash, salt, ...u }) => u) : rows;
  }
  downloadFile(`pingo-data-${toDateKey(Date.now())}.json`, JSON.stringify(out, null, 2));
}

// Полностью удалить базу на этом устройстве; при следующем запуске создадутся демо-данные.
export async function wipeAllData() {
  clearSession();
  db.close();
  await db.delete();
  window.location.assign('/');
}
