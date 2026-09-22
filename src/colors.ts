/** Пастельная палитра: цвет узла красит и его шапку, и рамку цитаты в родителе. */

const PASTELS = [
  '#fde2e4', '#fad2e1', '#e2ece9', '#bee1e6', '#cddafd',
  '#dfe7fd', '#fff1e6', '#fde4cf', '#e8dff5', '#d0f4de',
  '#f9f7d9', '#c7f0db', '#ffd6e0', '#d7e3fc', '#e4d9ff',
  '#fcf6bd', '#d1f0f7', '#ffe5d9', '#dbece5', '#f0e6ef',
];

export const DEFAULT_COLOR = '#dfe7fd';

export function randomPastel(exclude?: string | null): string {
  const pool = exclude ? PASTELS.filter((c) => c !== exclude) : PASTELS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Читаемый текст на этом фоне: тот же оттенок, но по другую сторону от фона.
 * Пипетка разрешает любой цвет, включая тёмный, поэтому направление выбирается
 * по светлоте фона, а не фиксируется — иначе тёмный текст тонет в тёмном фоне.
 */
export function inkFor(hex: string): string {
  const { h, s, l } = toHsl(hex);
  const sat = Math.max(30, Math.min(70, s));
  return l < 55 ? `hsl(${h} ${Math.min(45, sat)}% 96%)` : `hsl(${h} ${sat}% 28%)`;
}

/** Линия цитаты: насыщеннее фона, но не такая тёмная, как текст. */
export function lineFor(hex: string): string {
  const { h, s } = toHsl(hex);
  return `hsl(${h} ${Math.max(40, Math.min(75, s))}% 55%)`;
}

function toHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return { h: 220, s: 50, l: 60 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}
