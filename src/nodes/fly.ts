import { create } from 'zustand';
import type { ReactFlowInstance } from '@xyflow/react';
import { useDoc } from '../store/useDoc';
import { treeIndex } from '../store/treeIndex';
import { useAnchors } from '../edges/anchors';
import { estimateHeight, fullHeight, MAX_ZOOM } from './lod';
import type { NodeId } from '../types';

/** Палец: экран узкий, текст читаем только при ширине узла во весь экран. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Масштаб, при котором узел читается: на телефоне — узел во всю ширину экрана,
 * на широком экране — не мельче 0.8 и не крупнее, чем влезает по ширине.
 */
export function readableZoom(paneWidth: number, nodeWidth: number, current: number): number {
  const fit = Math.min(MAX_ZOOM, (paneWidth - 24) / nodeWidth);
  return TOUCH ? fit : Math.min(Math.max(current, 0.8), fit);
}

/** Узел, к которому только что перелетели: коротко подсвечивается, чтобы взгляд нашёл его сразу. */
export const useFlash = create<{ id: NodeId | null }>(() => ({ id: null }));
let flashTimer: ReturnType<typeof setTimeout> | undefined;

type Rf = Pick<ReactFlowInstance, 'getZoom' | 'setViewport'>;

/**
 * Перелёт камеры к узлу. Цель встаёт по центру по горизонтали и на 40% высоты
 * экрана по вертикали: к ответу — его начало, к источнику — цитата, на которую
 * ответили (её высоту в узле замеряет сам узел, см. anchors.ts).
 */
export function flyTo(rf: Rf, id: NodeId, quoteOf?: NodeId): void {
  const { nodes, width } = useDoc.getState();
  const node = treeIndex(nodes).byId.get(id);
  const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
  if (!node || !pane) return;

  const zoom = readableZoom(pane.width, width, rf.getZoom());
  const h = fullHeight.get(id) ?? estimateHeight(node.text, width);
  const quoteY = quoteOf ? useAnchors.getState().y[quoteOf] : undefined;
  // Начало ответа — шапка и первые строки; длинный узел не центрируется целиком,
  // иначе его начало уехало бы за верх экрана.
  const focusY = node.y + (quoteY ?? Math.min(h / 2, 120));

  void rf.setViewport(
    { x: pane.width / 2 - (node.x + width / 2) * zoom, y: pane.height * 0.4 - focusY * zoom, zoom },
    { duration: 450 },
  );
  clearTimeout(flashTimer);
  useFlash.setState({ id });
  flashTimer = setTimeout(() => useFlash.setState({ id: null }), 1400);
}
