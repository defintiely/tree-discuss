import type { DocState } from '../types';
import { decryptJson, encryptJson, passwordVerifier } from './crypto';

/**
 * Комната в облаке: одна строка на комнату, содержимое зашифровано паролем.
 * Адрес базы — публичный anon-ключ Supabase, он и рассчитан на то, чтобы
 * лежать в коде страницы; доступ к строкам ограничивают политики на сервере.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function cloudConfigured(): boolean {
  return Boolean(URL && KEY);
}

export type RoomInfo = { name: string; updatedAt: string };

type Row = {
  name: string;
  verifier: string;
  payload: string;
  updated_at: string;
};

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  if (!URL || !KEY) throw new Error('Облако не настроено: нет адреса базы в сборке.');
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function fetchRoom(name: string): Promise<Row | null> {
  const res = await call(`rooms?name=eq.${encodeURIComponent(name)}&select=*`);
  if (!res.ok) throw new Error(`База ответила ${res.status}. ${await res.text()}`);
  const rows = (await res.json()) as Row[];
  return rows[0] ?? null;
}

export async function roomExists(name: string): Promise<boolean> {
  return (await fetchRoom(name)) !== null;
}

export async function createRoom(name: string, password: string, doc: DocState): Promise<string> {
  if (await fetchRoom(name)) {
    throw new Error(`Комната «${name}» уже существует. Войдите в неё или выберите другое название.`);
  }
  const res = await call('rooms', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      name,
      verifier: await passwordVerifier(name, password),
      payload: await encryptJson(name, password, doc),
    }),
  });
  if (!res.ok) throw new Error(`Не удалось создать комнату: ${res.status}. ${await res.text()}`);
  const rows = (await res.json()) as Row[];
  return rows[0].updated_at;
}

export async function openRoom(name: string, password: string): Promise<{ doc: DocState; updatedAt: string }> {
  const row = await fetchRoom(name);
  if (!row) throw new Error(`Комната «${name}» не найдена. Проверьте название.`);
  if (row.verifier !== (await passwordVerifier(name, password))) {
    throw new Error('Неверный пароль.');
  }
  try {
    return { doc: await decryptJson<DocState>(name, password, row.payload), updatedAt: row.updated_at };
  } catch {
    throw new Error('Содержимое комнаты не читается — возможно, оно записано другим паролем.');
  }
}

export async function saveRoom(name: string, password: string, doc: DocState): Promise<string> {
  const res = await call(`rooms?name=eq.${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      verifier: await passwordVerifier(name, password),
      payload: await encryptJson(name, password, doc),
      // updated_at не шлём: его проставляет триггер в базе, и только её часы
      // общие для всех участников.
    }),
  });
  if (!res.ok) throw new Error(`Сохранение не прошло: ${res.status}. ${await res.text()}`);
  const rows = (await res.json()) as Row[];
  if (!rows.length) throw new Error('Комната не найдена при сохранении — возможно, её удалили.');
  return rows[0].updated_at;
}

/** Чужие правки: если строка в базе новее нашей, забираем её содержимое. */
export async function pullIfNewer(
  name: string,
  password: string,
  since: string,
): Promise<{ doc: DocState; updatedAt: string } | null> {
  const row = await fetchRoom(name);
  // Сравниваем МОМЕНТЫ, а не строки: сервер отдаёт «+00:00», браузер — «Z»,
  // и лексикографически «+00:00» меньше «Z» при одинаковом времени.
  if (!row || Date.parse(row.updated_at) <= Date.parse(since)) return null;
  return { doc: await decryptJson<DocState>(name, password, row.payload), updatedAt: row.updated_at };
}
