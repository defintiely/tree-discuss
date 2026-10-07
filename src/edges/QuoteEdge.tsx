import { BaseEdge, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react';
import { lineFor } from '../colors';
import { useAnchors } from './anchors';

/** Палец толще курсора: по тонкой линии иначе не попасть. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Начало стрелки — сама цитата в родителе, а не край узла. Высоту цитаты меряет
 * родитель (anchors.ts); пока замера нет или ответ ничего не цитирует — середина
 * правого края. Отсюда же считается, у какого конца тапнули по линии.
 */
export function quoteStart(src: InternalNode, anchorY: number | undefined, quotes: boolean): { x: number; y: number } {
  const w = src.measured?.width ?? 360;
  const h = src.measured?.height ?? 150;
  return {
    x: src.internals.positionAbsolute.x + w,
    y: src.internals.positionAbsolute.y + (quotes && anchorY !== undefined ? anchorY : h / 2),
  };
}

export function QuoteEdge({ id, source, target, targetX, targetY, markerEnd, data }: EdgeProps) {
  const src = useInternalNode(source);
  const anchorY = useAnchors((s) => s.y[target]);
  if (!src) return null;

  const d = data as { anchorStart?: number | null; color?: string } | undefined;
  const { x: sx, y: sy } = quoteStart(src, anchorY, d?.anchorStart !== null && d?.anchorStart !== undefined);
  const stroke = d?.color ? lineFor(d.color) : '#94a3b8';

  const mx = sx + Math.max(40, (targetX - sx) / 2);
  const path = `M ${sx},${sy} C ${mx},${sy} ${mx},${targetY} ${targetX},${targetY}`;
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{ stroke, strokeWidth: 2 }}
      interactionWidth={TOUCH ? 36 : 22}
    />
  );
}
