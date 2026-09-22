import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';
import { lineFor } from '../colors';

/**
 * Стрелка выходит из самого процитированного фрагмента, а не из края узла:
 * ищем в DOM родителя span, накрытый якорем этого ребёнка, и берём его центр.
 * Не нашли (текст переписали) — падаем на правый край родителя.
 */
export function QuoteEdge({ id, source, target, targetX, targetY, markerEnd, data }: EdgeProps) {
  const src = useInternalNode(source);
  const dst = useInternalNode(target);
  if (!src || !dst) return null;

  const w = src.measured?.width ?? 360;
  const h = src.measured?.height ?? 150;
  let sx = src.internals.positionAbsolute.x + w;
  let sy = src.internals.positionAbsolute.y + h / 2;

  const d = data as { anchorStart?: number | null; color?: string } | undefined;
  const stroke = d?.color ? lineFor(d.color) : '#94a3b8';
  const anchorStart = d?.anchorStart;
  if (anchorStart !== null && anchorStart !== undefined) {
    const host = document.querySelector(`[data-id="${source}"]`);
    const span = host?.querySelector<HTMLElement>(`[data-seg-start="${anchorStart}"]`);
    const box = host?.getBoundingClientRect();
    const sb = span?.getBoundingClientRect();
    if (box && sb && box.width > 0) {
      const scale = w / box.width;
      sx = src.internals.positionAbsolute.x + w;
      sy = src.internals.positionAbsolute.y + (sb.top + sb.height / 2 - box.top) * scale;
    }
  }

  const mx = sx + Math.max(40, (targetX - sx) / 2);
  const path = `M ${sx},${sy} C ${mx},${sy} ${mx},${targetY} ${targetX},${targetY}`;
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 2 }} />;
}
