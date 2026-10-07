import type { NodeId } from '../types';

/**
 * Зум, ниже которого текст узлов не рисуется: шрифт 13.5px становится мельче
 * 7px, читать его уже нельзя, а браузеру раскладка тысяч глифов обходится дорого.
 * Вместо текста — серые полосы на месте строк.
 */
export const LOD_ZOOM = 0.5;

const LINE = 21;
const HEAD = 33;
const FOOT = 41;
/** Средняя ширина символа шрифта узла — для оценки числа строк. */
const CHAR = 7.2;

/** Высоты узлов в полной отрисовке: упрощённый узел встаёт ровно в тот же размер. */
export const fullHeight = new Map<NodeId, number>();

/** Высота узла, ни разу не нарисованного полностью (канвас открыли сразу издалека). */
export function estimateHeight(text: string, width: number): number {
  const perLine = Math.max(1, Math.floor((width - 20) / CHAR));
  const lines = text
    ? text.split('\n').reduce((sum, p) => sum + Math.max(1, Math.ceil(p.length / perLine)), 0)
    : 1;
  return HEAD + lines * LINE + 20 + FOOT;
}
