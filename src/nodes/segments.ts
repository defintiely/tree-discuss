import type { NodeId, TextSegment, TreeNode } from '../types';

/**
 * Режет текст узла на куски по ВСЕМ границам якорей его детей.
 * Пересекающиеся якоря поэтому не требуют вложенных элементов: кусок, попавший
 * под две цитаты сразу, просто знает про обе и рисуется насыщеннее.
 */
export function sliceText(text: string, children: TreeNode[]): TextSegment[] {
  const anchors = children
    .filter((c) => c.anchorStart !== null && c.anchorEnd !== null)
    .map((c) => ({
      id: c.id,
      color: c.color,
      start: clamp(c.anchorStart as number, 0, text.length),
      end: clamp(c.anchorEnd as number, 0, text.length),
    }))
    .filter((a) => a.end > a.start);

  if (!anchors.length) {
    return text.length ? [{ text, start: 0, end: text.length, anchoredBy: [], colors: [] }] : [];
  }

  const cuts = new Set<number>([0, text.length]);
  for (const a of anchors) {
    cuts.add(a.start);
    cuts.add(a.end);
  }
  const bounds = [...cuts].sort((p, q) => p - q);

  const out: TextSegment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    if (end <= start) continue;
    const covering = anchors.filter((a) => a.start <= start && a.end >= end);
    const anchoredBy: NodeId[] = covering.map((a) => a.id);
    out.push({
      text: text.slice(start, end),
      start,
      end,
      anchoredBy,
      colors: covering.map((a) => a.color),
    });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Позиция нового ответа: справа от родителя, вниз до первого свободного места. */
export function placeReply(parent: TreeNode, all: TreeNode[]): { x: number; y: number } {
  const x = parent.x + 420;
  const STEP = 40;
  const H = 170;
  let y = parent.y;
  for (let guard = 0; guard < 400; guard++) {
    const busy = all.some((n) => Math.abs(n.x - x) < 380 && Math.abs(n.y - y) < H);
    if (!busy) return { x, y };
    y += STEP;
  }
  return { x, y };
}
