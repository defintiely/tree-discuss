import { create } from 'zustand';
import type { NodeId } from '../types';

/**
 * Где в родителе стоит цитата каждого ответа: отступ середины цитаты от верха
 * узла-родителя, в координатах канваса (без зума).
 *
 * Меряет сам узел-родитель после своей отрисовки, а стрелка только читает:
 * замер из стрелки на каждой её перерисовке заставлял бы браузер пересчитывать
 * раскладку страницы на каждом кадре перетаскивания.
 * Пока родитель нарисован без текста (дальний зум) или не нарисован вовсе (за
 * кадром), здесь остаётся последнее измерение — стрелка не прыгает.
 */
type Anchors = {
  y: Record<NodeId, number>;
  put: (entries: [NodeId, number][]) => void;
};

export const useAnchors = create<Anchors>((set) => ({
  y: {},
  put: (entries) =>
    set((s) => {
      const changed = entries.filter(([id, v]) => s.y[id] !== v);
      if (!changed.length) return s;
      return { y: { ...s.y, ...Object.fromEntries(changed) } };
    }),
}));
