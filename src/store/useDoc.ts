/**
 * Стор документа. Правит его ТОЛЬКО оркестратор — агенты его читают.
 */

import { create } from 'zustand';
import { KIND_TITLE, newId, type DocState, type NodeId, type NodeKind, type TreeNode } from '../types';
import { DEFAULT_COLOR, randomPastel } from '../colors';
import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from '../layout';

type DocStore = DocState & {
  replaceAll: (doc: DocState) => void;
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
  setPos: (id: NodeId, x: number, y: number) => void;
  setKind: (id: NodeId, kind: NodeKind) => void;
  bumpReaction: (id: NodeId, emoji: string, delta: number) => void;
  removeSubtree: (id: NodeId) => void;
  childrenOf: (id: NodeId | null) => TreeNode[];
  subtreeIds: (id: NodeId) => NodeId[];
};

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
  text: 'Центральный тезис. Выдели любой фрагмент этого текста и нажми «Ответить».',
  x: 0,
  y: 0,
  anchorStart: null,
  anchorEnd: null,
  color: DEFAULT_COLOR,
  author: '',
  quote: '',
};

export const useDoc = create<DocStore>((set, get) => ({
  nodes: [ROOT],
  reactions: [],
  width: DEFAULT_WIDTH,

  replaceAll: (doc) =>
    set({ nodes: doc.nodes, reactions: doc.reactions, width: clampWidth(doc.width) }),

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

  setPos: (id, x, y) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

  setKind: (id, kind) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, kind, title: KIND_TITLE[kind] } : n)),
    })),

  bumpReaction: (id, emoji, delta) =>
    set((s) => {
      const i = s.reactions.findIndex((r) => r.nodeId === id && r.emoji === emoji);
      if (i === -1) {
        return delta > 0 ? { reactions: [...s.reactions, { nodeId: id, emoji, count: delta }] } : s;
      }
      const next = s.reactions.slice();
      const count = next[i].count + delta;
      if (count <= 0) next.splice(i, 1);
      else next[i] = { ...next[i], count };
      return { reactions: next };
    }),

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
