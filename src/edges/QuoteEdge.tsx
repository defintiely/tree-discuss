import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';
import { lineFor } from '../colors';
import { useAnchors } from './anchors';

/**
 * Стрелка выходит из самого процитированного фрагмента, а не из края узла.
 * Высоту цитаты в родителе меряет сам родитель (anchors.ts); пока замера нет
 * или ответ ничего не цитирует — стрелка идёт от середины правого края.
 */
export function QuoteEdge({ id, source, target, targetX, targetY, markerEnd, data }: EdgeProps) {
  const src = useInternalNode(source);
  const anchorY = useAnchors((s) => s.y[target]);
  if (!src) return null;

  const w = src.measured?.width ?? 360;
  const h = src.measured?.height ?? 150;
  const d = data as { anchorStart?: number | null; color?: string } | undefined;
  const quotes = d?.anchorStart !== null && d?.anchorStart !== undefined;

  const sx = src.internals.positionAbsolute.x + w;
  const sy = src.internals.positionAbsolute.y + (quotes && anchorY !== undefined ? anchorY : h / 2);
  const stroke = d?.color ? lineFor(d.color) : '#94a3b8';

  const mx = sx + Math.max(40, (targetX - sx) / 2);
  const path = `M ${sx},${sy} C ${mx},${sy} ${mx},${targetY} ${targetX},${targetY}`;
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 2 }} />;
}
