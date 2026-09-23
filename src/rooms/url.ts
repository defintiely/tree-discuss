/**
 * Название комнаты в адресе страницы.
 *
 * Живёт в хеше (`#/room/имя`), а не в пути: на GitHub Pages нет сервера,
 * который знал бы про такие пути, и обычная ссылка вида `/room/имя` вернула бы 404.
 *
 * Пароль в адрес НЕ попадает: ссылка уходит в историю браузера, в закладки
 * и в чат, куда её вставили, — там ему не место.
 */

const PREFIX = '#/room/';

export function roomFromUrl(): string {
  const hash = window.location.hash;
  if (!hash.startsWith(PREFIX)) return '';
  try {
    return decodeURIComponent(hash.slice(PREFIX.length)).trim();
  } catch {
    return '';
  }
}

/** Ставит комнату в адрес, не добавляя запись в историю: кнопка «назад» не должна
 *  прыгать между комнатами, в которые человек не заходил. */
export function setRoomInUrl(name: string): void {
  const next = PREFIX + encodeURIComponent(name);
  if (window.location.hash === next) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
}

export function clearRoomInUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function roomLink(name: string): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${PREFIX}${encodeURIComponent(name)}`;
}
