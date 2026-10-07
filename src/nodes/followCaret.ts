import type { ReactFlowInstance } from '@xyflow/react';

/** Палец: экран узкий, текст читаем только при ширине узла во весь экран. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** Где в textarea строка с кареткой: отступ от верха поля и высота строки, без зума канваса. */
function caretLine(ta: HTMLTextAreaElement): { top: number; height: number } {
  // У textarea нет координат каретки — текст до неё раскладывается в невидимой
  // копии поля с теми же шрифтом, отступами и шириной, и меряется метка в конце.
  const cs = getComputedStyle(ta);
  const mirror = document.createElement('div');
  for (const p of [
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'wordBreak', 'overflowWrap', 'tabSize',
  ] as const) {
    mirror.style[p] = cs[p];
  }
  Object.assign(mirror.style, {
    position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px',
    whiteSpace: 'pre-wrap', width: `${ta.offsetWidth}px`,
  });
  mirror.textContent = ta.value.slice(0, ta.selectionEnd);
  const mark = document.createElement('span');
  mark.textContent = '​';
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const line = { top: mark.offsetTop, height: mark.offsetHeight };
  mirror.remove();
  return line;
}

/**
 * Канвас едет за печатающим: узел встаёт по центру по горизонтали, а строка
 * с кареткой — в верхнюю треть ВИДИМОЙ части экрана. Видимая часть считается
 * по visualViewport: экранная клавиатура перекрывает низ, не уменьшая страницу,
 * и центр канваса оказался бы под клавиатурой.
 */
export function followCaret(
  ta: HTMLTextAreaElement,
  node: { x: number; y: number },
  width: number,
  rf: Pick<ReactFlowInstance, 'getZoom' | 'setViewport'>,
  animate: boolean,
): void {
  const pane = ta.closest('.react-flow');
  if (!pane) return;
  const rect = pane.getBoundingClientRect();
  const vv = window.visualViewport;
  const visTop = Math.max(rect.top, vv?.offsetTop ?? 0);
  const visBottom = Math.min(rect.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
  if (visBottom - visTop < 40) return;

  const fit = (rect.width - 24) / width;
  const zoom = TOUCH ? fit : Math.min(Math.max(rf.getZoom(), 0.8), fit);

  const line = caretLine(ta);
  // offsetTop поля — от обёртки узла, которая стоит в точке (x, y) канваса.
  const caretY = node.y + ta.offsetTop + line.top + line.height / 2;
  const targetY = visTop + (visBottom - visTop) * 0.35 - rect.top;

  void rf.setViewport(
    { x: rect.width / 2 - (node.x + width / 2) * zoom, y: targetY - caretY * zoom, zoom },
    { duration: animate ? 250 : 0 },
  );
}

/** Поле растёт под текст, а не прячет строки во внутренний скролл. */
export function autosize(ta: HTMLTextAreaElement): void {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}
