import { create } from 'zustand';
import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from '../layout';

/**
 * Кто пишет СЕЙЧАС. Это не часть документа: ник живёт в браузере автора,
 * а в узел попадает копией в момент создания — поэтому смена ника задним
 * числом не переписывает авторство уже созданных узлов.
 */

const KEY = 'tree-discuss-me';
const W_KEY = 'tree-discuss-width';

type Me = {
  name: string;
  setName: (name: string) => void;
  /** Ширина узлов — одна на весь канвас, настройка вида, а не документа. */
  width: number;
  setWidth: (w: number) => void;
};

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function loadWidth(): number {
  try {
    const raw = Number(localStorage.getItem(W_KEY));
    return Number.isFinite(raw) && raw >= MIN_WIDTH && raw <= MAX_WIDTH ? raw : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export const useMe = create<Me>((set) => ({
  name: load(),
  width: loadWidth(),

  setWidth: (w) => {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));
    try {
      localStorage.setItem(W_KEY, String(clamped));
    } catch {
      /* приватный режим — ширина проживёт только эту вкладку */
    }
    set({ width: clamped });
  },

  setName: (name) => {
    try {
      localStorage.setItem(KEY, name);
    } catch {
      /* приватный режим — ник проживёт только эту вкладку */
    }
    set({ name });
  },
}));
