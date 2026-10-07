import type { TouchEvent } from 'react';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import { MAX_ZOOM, MIN_ZOOM } from './lod';

type Point = { x: number; y: number };
type Rf = Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;

/** Сдвиг пальца, после которого касание считается протяжкой, а не тапом или долгим нажатием. */
const SLOP = 8;

const points = (e: TouchEvent): Point[] => Array.from(e.touches, (t) => ({ x: t.clientX, y: t.clientY }));
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;

/**
 * Карта под пальцем на тексте узла: одним пальцем — сдвиг, двумя — масштаб.
 *
 * Свой обработчик, а не жест React Flow: React Flow помечает каждый перетаскиваемый
 * узел целиком как «не двигать карту» (класс noPanClassName на обёртке узла),
 * и снять эту пометку только с текста нельзя.
 *
 * Пока в узле выделен текст, палец тянет выделение, а не карту.
 */
export function panGesture(rf: Rf) {
  let start: { pts: Point[]; vp: Viewport; pane: DOMRect } | null = null;
  let moving = false;

  const begin = (e: TouchEvent) => {
    const pane = (e.currentTarget as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    start = pane ? { pts: points(e), vp: rf.getViewport(), pane } : null;
  };

  const selecting = (e: TouchEvent) => {
    const s = window.getSelection();
    return Boolean(s && !s.isCollapsed && s.anchorNode && (e.currentTarget as HTMLElement).contains(s.anchorNode));
  };

  return {
    onTouchStart(e: TouchEvent) {
      moving = false;
      begin(e);
    },
    onTouchMove(e: TouchEvent) {
      if (!start || selecting(e)) return;
      const now = points(e);
      if (now.length !== start.pts.length) return begin(e);
      const { pts, vp, pane } = start;

      if (now.length === 1) {
        const dx = now[0].x - pts[0].x;
        const dy = now[0].y - pts[0].y;
        if (!moving && Math.hypot(dx, dy) < SLOP) return;
        moving = true;
        void rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom });
        return;
      }

      moving = true;
      const c0 = mid(pts[0], pts[1]);
      const c1 = mid(now[0], now[1]);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (vp.zoom * dist(now[0], now[1])) / dist(pts[0], pts[1])));
      // Точка карты, бывшая под серединой пальцев, остаётся под ней — как при щипке по пустому месту.
      const fx = (c0.x - pane.left - vp.x) / vp.zoom;
      const fy = (c0.y - pane.top - vp.y) / vp.zoom;
      void rf.setViewport({ x: c1.x - pane.left - fx * zoom, y: c1.y - pane.top - fy * zoom, zoom });
    },
    onTouchEnd(e: TouchEvent) {
      // Один палец из двух подняли — оставшийся продолжает сдвиг с текущего места.
      if (e.touches.length) begin(e);
      else start = null;
    },
    onTouchCancel() {
      start = null;
    },
  };
}
