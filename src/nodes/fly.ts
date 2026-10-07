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
let flashTimers: ReturnType<typeof setTimeout>[] = [];

export const FLY_MS = 750;
/** Длительность вспышки — та же, что у анимации .dn-flash в index.css. */
const FLASH_MS = 1300;
const quadInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

type Rf = Pick<ReactFlowInstance, 'getZoom' | 'setViewport'>;

/**
 * Перелёт камеры к узлу, по горизонтали — в центр. По вертикали узел, который
 * влезает в экран, встаёт по центру целиком; не влезающий упирается шапкой в верх
 * экрана — читать его начинают сверху. Исключение — перелёт к цитате в длинном
 * источнике (её высоту в узле замеряет сам узел, см. anchors.ts): если от шапки
 * до неё не достать, по центру встаёт сама цитата.
 */
export function flyTo(rf: Rf, id: NodeId, quoteOf?: NodeId): void {
  const { nodes, width } = useDoc.getState();
  const node = treeIndex(nodes).byId.get(id);
  const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
  if (!node || !pane) return;

  const zoom = readableZoom(pane.width, width, rf.getZoom());
  const h = fullHeight.get(id) ?? estimateHeight(node.text, width);
  const quoteY = quoteOf ? useAnchors.getState().y[quoteOf] : undefined;

  let y = pane.height / 2 - (node.y + h / 2) * zoom;
  if (h * zoom > pane.height) {
    y = -node.y * zoom;
    if (quoteY !== undefined && quoteY * zoom > pane.height * 0.85) {
      y = pane.height * 0.4 - (node.y + quoteY) * zoom;
    }
  }

  void rf.setViewport(
    { x: pane.width / 2 - (node.x + width / 2) * zoom, y, zoom },
    { duration: FLY_MS, ease: quadInOut, interpolate: 'linear' },
  );
  // Вспышка — по прилёту: во время полёта узел ещё не там, куда смотрит взгляд.
  flashTimers.forEach(clearTimeout);
  useFlash.setState({ id: null });
  flashTimers = [
    setTimeout(() => useFlash.setState({ id }), FLY_MS),
    setTimeout(() => useFlash.setState({ id: null }), FLY_MS + FLASH_MS),
  ];
}
