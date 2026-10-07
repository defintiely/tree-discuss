import { create } from 'zustand';
import { useDoc } from './useDoc';

/**
 * Кто пишет СЕЙЧАС. Это не часть документа: ник живёт в браузере автора,
 * а в узел попадает копией в момент создания — поэтому смена ника задним
 * числом не переписывает авторство уже созданных узлов.
 */

const KEY = 'tree-discuss-me';

type Action = (me: string) => void;

type Me = {
  name: string;
  setName: (name: string) => void;
  /** Открыт выбор автора. */
  picking: boolean;
  /** Правка, ради которой спросили автора: выполняется сразу после выбора. */
  pending: Action | null;
  openPicker: (then?: Action) => void;
  closePicker: () => void;
};

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export const useMe = create<Me>((set) => ({
  name: load(),
  picking: false,
  pending: null,

  setName: (name) => {
    try {
      localStorage.setItem(KEY, name);
    } catch {
      /* приватный режим — ник проживёт только эту вкладку */
    }
    set({ name });
  },

  openPicker: (then) => set({ picking: true, pending: then ?? null }),
  closePicker: () => set({ picking: false, pending: null }),
}));

/**
 * Любая правка идёт от имени участника ЭТОГО обсуждения. Ник, запомненный
 * браузером в другой комнате, сюда автоматически не переносится — человека
 * спрашивают, кем он здесь, и правка выполняется после ответа.
 */
export function asAuthor(action: Action): void {
  const me = useMe.getState().name;
  if (me && useDoc.getState().participants.includes(me)) return action(me);
  useMe.getState().openPicker(action);
}

/** Участники для выбора: список обсуждения плюс авторы узлов, если их там нет. */
export function knownParticipants(participants: string[], authors: string[]): string[] {
  return [...new Set([...participants, ...authors.filter(Boolean)])];
}
