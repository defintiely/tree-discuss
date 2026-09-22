import { create } from 'zustand';

/**
 * Сессия комнаты. Пароль держится только в памяти вкладки: в localStorage он
 * не пишется, поэтому закрытая вкладка не оставляет ключ от комнаты на машине.
 * Перезагрузка страницы просит пароль заново — это осознанная цена.
 */

export type SyncState = 'idle' | 'saving' | 'saved' | 'error';

type Room = {
  name: string | null;
  password: string | null;
  updatedAt: string;
  sync: SyncState;
  error: string | null;
  /** Правки, которых ещё нет в облаке. */
  dirty: boolean;

  enter: (name: string, password: string, updatedAt: string) => void;
  leave: () => void;
  markDirty: () => void;
  setSync: (sync: SyncState, error?: string | null) => void;
  setUpdatedAt: (at: string) => void;
};

export const useRoom = create<Room>((set) => ({
  name: null,
  password: null,
  updatedAt: '',
  sync: 'idle',
  error: null,
  dirty: false,

  enter: (name, password, updatedAt) =>
    set({ name, password, updatedAt, sync: 'saved', error: null, dirty: false }),

  leave: () => set({ name: null, password: null, updatedAt: '', sync: 'idle', error: null, dirty: false }),

  markDirty: () => set({ dirty: true }),

  setSync: (sync, error = null) => set({ sync, error, ...(sync === 'saved' ? { dirty: false } : {}) }),

  setUpdatedAt: (at) => set({ updatedAt: at }),
}));
