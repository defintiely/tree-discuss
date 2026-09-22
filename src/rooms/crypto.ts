/**
 * Пароль комнаты не покидает браузер и в базу не попадает.
 *
 * В базе лежат две разные величины, выведенные из пароля разными солями:
 *  - verifier — по нему сервер отличает верный пароль от неверного;
 *  - ключ шифрования — им шифруется содержимое комнаты, и он НИКУДА не отправляется.
 *
 * Поэтому у того, кто получил доступ к таблице, нет ни пароля, ни текста
 * обсуждения: строки зашифрованы, а verifier обратно в пароль не разворачивается.
 */

const ITERATIONS = 210_000;

async function deriveBits(password: string, salt: string, bits: number): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    bits,
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Что уходит в базу как доказательство знания пароля. */
export async function passwordVerifier(room: string, password: string): Promise<string> {
  return toHex(await deriveBits(password, `tree-discuss:verify:${room}`, 256));
}

/** Ключ шифрования содержимого — остаётся только в этой вкладке. */
async function contentKey(room: string, password: string): Promise<CryptoKey> {
  const bits = await deriveBits(password, `tree-discuss:content:${room}`, 256);
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJson(room: string, password: string, data: unknown): Promise<string> {
  const key = await contentKey(room, password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptJson<T>(room: string, password: string, payload: string): Promise<T> {
  const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const key = await contentKey(room, password);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12) },
    key,
    raw.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
