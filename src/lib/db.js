// Локальное зеркало данных из Firestore — в памяти вкладки.
// Его наполняют слушатели onSnapshot из src/services/sync.js: в зеркале только то, что правила
// безопасности разрешают видеть текущему пользователю. Страницы и сервисы читают отсюда через
// привычный API (get / bulkGet / toArray / where().equals() / anyOf()), а пишут сервисы в Firestore —
// изменения возвращаются сюда через тех же слушателей (сразу, ещё до ответа сервера).

const TABLES = [
  'users',
  'children',
  'profiles',
  'availability',
  'bookings',
  'busy',
  'reviews',
  'conversations',
  'messages',
  'notifications',
  'complaints',
  'certificates',
  'broadcasts',
  'moderators',
];

const watchers = new Set();
let scheduled = false;

function changed() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of watchers) fn();
  });
}

// Подписка на любые изменения зеркала (их собирает в пачку один микротаск).
export function subscribe(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

class Collection {
  constructor(rows) {
    this.rows = rows;
  }
  async toArray() {
    return this.rows;
  }
  async count() {
    return this.rows.length;
  }
  async first() {
    return this.rows[0];
  }
}

class Table {
  constructor(name) {
    this.name = name;
    this.rows = new Map();
    // Одна строка может прийти из нескольких источников (например, users: свой документ и публичная
    // карточка people). Строка = объединение данных всех источников, по возрастанию rank.
    this.sources = new Map();
  }

  async get(id) {
    return this.rows.get(id);
  }
  async bulkGet(ids) {
    return ids.map((id) => this.rows.get(id));
  }
  async toArray() {
    return [...this.rows.values()];
  }
  async count() {
    return this.rows.size;
  }
  where(field) {
    const all = () => [...this.rows.values()];
    return {
      equals: (value) => new Collection(all().filter((r) => r[field] === value)),
      anyOf: (values) => {
        const set = new Set(values);
        return new Collection(all().filter((r) => set.has(r[field])));
      },
    };
  }

  // Синхронный доступ — для сервисов и синхронизации.
  peek(id) {
    return this.rows.get(id);
  }
  values() {
    return [...this.rows.values()];
  }

  apply(id, source, data, rank = 0) {
    let parts = this.sources.get(id);
    if (data) {
      if (!parts) this.sources.set(id, (parts = new Map()));
      parts.set(source, { data, rank });
    } else if (parts) {
      parts.delete(source);
      if (!parts.size) this.sources.delete(id);
    }
    if (parts?.size) {
      const ordered = [...parts.values()].sort((a, b) => a.rank - b.rank).map((p) => p.data);
      this.rows.set(id, Object.assign({}, ...ordered));
    } else {
      this.rows.delete(id);
    }
    changed();
  }

  clear() {
    this.rows.clear();
    this.sources.clear();
  }
}

export const db = Object.fromEntries(TABLES.map((name) => [name, new Table(name)]));
db.tables = TABLES.map((name) => db[name]);

// Какие строки дал каждый источник — чтобы убрать их все, когда слушатель остановлен.
const bySource = new Map();

export function mirrorPut(table, id, source, data, rank = 0) {
  if (!bySource.has(source)) bySource.set(source, new Set());
  bySource.get(source).add(`${table}\u0000${id}`);
  db[table].apply(id, source, data, rank);
}

export function mirrorRemove(table, id, source) {
  bySource.get(source)?.delete(`${table}\u0000${id}`);
  db[table].apply(id, source, null);
}

export function mirrorDropSource(source) {
  const keys = bySource.get(source);
  if (!keys) return;
  bySource.delete(source);
  for (const key of keys) {
    const [table, id] = key.split('\u0000');
    db[table].apply(id, source, null);
  }
}

export function mirrorClear() {
  bySource.clear();
  for (const t of db.tables) t.clear();
  changed();
}
