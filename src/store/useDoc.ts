/**
 * Стор документа. Правит его ТОЛЬКО оркестратор — агенты его читают.
 */

import { create } from 'zustand';
import { KIND_TITLE, NAME_MAX, newId, normalizeDoc, reactionTotal, type DocState, type NodeId, type NodeKind, type Reaction, type TreeNode } from '../types';
import { DEFAULT_COLOR, randomPastel } from '../colors';
import { responseKeys } from './awaiting';
import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from '../layout';

type DocStore = DocState & {
  replaceAll: (doc: DocState) => void;
  addParticipant: (name: string) => void;
  toggleCloseVote: (id: NodeId, author: string) => void;
  setClosed: (id: NodeId, closed: boolean) => void;
  /** Автор посмотрел отклики на эти узлы: белый нотиф на них гаснет. */
  ackResponses: (ids: NodeId[]) => void;
  setWidth: (width: number) => void;
  addReply: (args: {
    parentId: NodeId;
    /** Пусто — ответ на весь текст: цвет наследуется от родителя. */
    anchorStart?: number | null;
    anchorEnd?: number | null;
    x: number;
    y: number;
    author: string;
  }) => NodeId;
  setColor: (id: NodeId, color: string) => void;
  applyLayout: (pos: Map<NodeId, { x: number; y: number }>) => void;
  setText: (id: NodeId, text: string) => void;
  setName: (id: NodeId, name: string) => void;
  setPos: (id: NodeId, x: number, y: number) => void;
  setKind: (id: NodeId, kind: NodeKind) => void;
  /** Своя реакция: есть — снимается, нет — ставится. */
  toggleReaction: (id: NodeId, emoji: string, me: string) => void;
  /** Поставить свою реакцию из палитры; уже стоит — ничего не меняется. */
  addReaction: (id: NodeId, emoji: string, me: string) => void;
  /** Снять одну безымянную реакцию. */
  dropAnonReaction: (id: NodeId, emoji: string) => void;
  removeSubtree: (id: NodeId) => void;
  childrenOf: (id: NodeId | null) => TreeNode[];
  subtreeIds: (id: NodeId) => NodeId[];
};

/**
 * Меняет одну реакцию узла (нет такой — начинает с пустой) и убирает её,
 * если после правки на ней не осталось ни одного человека.
 */
function editReaction(list: Reaction[], id: NodeId, emoji: string, fn: (r: Reaction) => Reaction): Reaction[] {
  const i = list.findIndex((r) => r.nodeId === id && r.emoji === emoji);
  const next = fn(i === -1 ? { nodeId: id, emoji, by: [], anon: 0 } : list[i]);
  const out = list.slice();
  if (i === -1) {
    if (reactionTotal(next) > 0) out.push(next);
  } else if (reactionTotal(next) > 0) out[i] = next;
  else out.splice(i, 1);
  return out;
}

function clampWidth(w: unknown): number {
  const n = Number(w);
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)));
}

const ROOT: TreeNode = {
  id: 'root',
  parentId: null,
  kind: 'root',
  title: KIND_TITLE.root,
  name: '',
  text: 'Центральный тезис. Выдели любой фрагмент этого текста и нажми «Ответить».',
  x: 0,
  y: 0,
  anchorStart: null,
  anchorEnd: null,
  color: DEFAULT_COLOR,
  author: '',
  quote: '',
  closed: false,
  closeVotes: [],
  seen: [],
};

/** Чистый документ новой комнаты: старое дерево в него не просачивается. */
export function emptyDoc(width: number = DEFAULT_WIDTH): DocState {
  return { nodes: [{ ...ROOT }], reactions: [], width: clampWidth(width), participants: [] };
}

export const useDoc = create<DocStore>((set, get) => ({
  nodes: [ROOT],
  reactions: [],
  width: DEFAULT_WIDTH,
  participants: [],

  replaceAll: (doc) => {
    const d = normalizeDoc(doc, DEFAULT_WIDTH);
    set({ nodes: d.nodes, reactions: d.reactions, width: clampWidth(d.width), participants: d.participants });
  },

  addParticipant: (name) =>
    set((s) => (s.participants.includes(name) ? s : { participants: [...s.participants, name] })),

  toggleCloseVote: (id, author) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id) return n;
        const has = n.closeVotes.includes(author);
        return { ...n, closeVotes: has ? n.closeVotes.filter((a) => a !== author) : [...n.closeVotes, author] };
      }),
    })),

  setClosed: (id, closed) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, closed } : n)) })),

  ackResponses: (ids) =>
    set((s) => {
      const want = new Set(ids);
      let changed = false;
      const nodes = s.nodes.map((n) => {
        if (!want.has(n.id)) return n;
        const keys = responseKeys(n, s.reactions);
        // Список заменяется текущими откликами целиком: снятые реакции из него уходят сами.
        if (keys.length === n.seen.length && keys.every((k) => n.seen.includes(k))) return n;
        changed = true;
        return { ...n, seen: keys };
      });
      return changed ? { nodes } : s;
    }),

  // Ширина приезжает из облака и из чужих правок, поэтому границы держит стор,
  // а не разметка ползунка: битое значение иначе растянуло бы узлы на весь экран.
  setWidth: (width) => set({ width: clampWidth(width) }),

  addReply: ({ parentId, anchorStart = null, anchorEnd = null, x, y, author }) => {
    const id = newId();
    const parent = get().nodes.find((n) => n.id === parentId);
    const quotes = anchorStart !== null && anchorEnd !== null;
    // Ответ на весь текст ничего не выделяет, поэтому берёт цвет источника;
    // ответ на фрагмент получает свой, чтобы цитаты в родителе различались.
    const color = quotes ? randomPastel(parent?.color) : (parent?.color ?? DEFAULT_COLOR);
    const node: TreeNode = {
      id,
      parentId,
      kind: 'reply',
      title: KIND_TITLE.reply,
      name: '',
      text: '',
      x,
      y,
      anchorStart,
      anchorEnd,
      color,
      author,
      // Цитата хранится и текстом: так связь читается в выгруженном CSV
      // и переживает возврат файла из внешнего редактора.
      quote: quotes && parent ? parent.text.slice(anchorStart!, anchorEnd!) : '',
      closed: false,
      closeVotes: [],
      seen: [],
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    return id;
  },

  setColor: (id, color) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, color } : n)) })),

  applyLayout: (pos) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const p = pos.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
    })),

  setText: (id, text) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, text } : n)) })),

  setName: (id, name) => {
    const clean = name.trim().slice(0, NAME_MAX);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id && n.name !== clean ? { ...n, name: clean } : n)) }));
  },

  setPos: (id, x, y) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

  setKind: (id, kind) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, kind, title: KIND_TITLE[kind] } : n)),
    })),

  toggleReaction: (id, emoji, me) =>
    set((s) => ({
      reactions: editReaction(s.reactions, id, emoji, (r) =>
        r.by.includes(me) ? { ...r, by: r.by.filter((n) => n !== me) } : { ...r, by: [...r.by, me] },
      ),
    })),

  addReaction: (id, emoji, me) =>
    set((s) => ({
      reactions: editReaction(s.reactions, id, emoji, (r) => (r.by.includes(me) ? r : { ...r, by: [...r.by, me] })),
    })),

  dropAnonReaction: (id, emoji) =>
    set((s) => ({
      reactions: editReaction(s.reactions, id, emoji, (r) => ({ ...r, anon: Math.max(0, r.anon - 1) })),
    })),

  removeSubtree: (id) => {
    const doomed = new Set(get().subtreeIds(id));
    set((s) => ({
      nodes: s.nodes.filter((n) => !doomed.has(n.id)),
      reactions: s.reactions.filter((r) => !doomed.has(r.nodeId)),
    }));
  },

  childrenOf: (id) => get().nodes.filter((n) => n.parentId === id),

  subtreeIds: (id) => {
    const out: NodeId[] = [];
    const walk = (cur: NodeId) => {
      out.push(cur);
      for (const c of get().nodes.filter((n) => n.parentId === cur)) walk(c.id);
    };
    walk(id);
    return out;
  },
}));
