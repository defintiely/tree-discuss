import type { NodeId, TreeNode } from './types';

/**
 * Раскладка дерева по колонкам: глубина узла задаёт колонку, а внутри группы
 * детей порядок берётся от позиции цитаты в тексте родителя — так порядок на
 * канвасе совпадает с порядком чтения самого текста.
 */

/** Расстояние между колонками: ширина узла задаётся отдельно, отсюда просвет. */
export const COL_GAP = 120;
/** Просвет МЕЖДУ узлами по вертикали, а не шаг между их центрами. */
export const ROW_GAP = 40;
/** Оценка высоты, когда DOM ещё не измерен. */
const FALLBACK_H = 150;

/** Высоты узлов на момент раскладки: измеренные в DOM, иначе оценка. */
export type Heights = Map<NodeId, number>;

/** Ширина узлов на канвасе — одна на всех, задаётся в панели. */
export const DEFAULT_WIDTH = 340;
export const MIN_WIDTH = 220;
export const MAX_WIDTH = 900;

export function layoutTree(
  nodes: TreeNode[],
  heights?: Heights,
  width: number = DEFAULT_WIDTH,
): Map<NodeId, { x: number; y: number }> {
  const pos = new Map<NodeId, { x: number; y: number }>();
  const root = nodes.find((n) => !n.parentId);
  if (!root) return pos;

  // Индекс в исходном массиве — устойчивый доп-ключ: при равных якорях
  // порядок остаётся тем же от прогона к прогону.
  const seq = new Map<NodeId, number>(nodes.map((n, i) => [n.id, i]));

  const kids = new Map<NodeId, TreeNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = kids.get(n.parentId) ?? [];
    list.push(n);
    kids.set(n.parentId, list);
  }

  // Порядок внутри группы: по началу цитаты. Ответ на всё сообщение цитаты не
  // имеет, поэтому встаёт после процитированных — он относится к тексту целиком.
  for (const [, list] of kids) {
    list.sort((a, b) => {
      const pa = a.anchorStart ?? Number.MAX_SAFE_INTEGER;
      const pb = b.anchorStart ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return (seq.get(a.id) ?? 0) - (seq.get(b.id) ?? 0);
    });
  }

  const h = (id: NodeId) => heights?.get(id) ?? FALLBACK_H;

  /**
   * Размещение идёт в два прохода, потому что две цели тянут в разные стороны:
   * просвет между соседями должен быть РОВНЫМ, а родитель — стоять в середине
   * своих ответов.
   *
   * Сначала лист встаёт на первое свободное место сверху вниз — так между
   * соседями всегда ровно ROW_GAP и пустот не возникает. Затем родитель
   * поднимается на середину между первым и последним своим ребёнком.
   */
  const rows = new Map<number, number>(); // колонка → нижняя занятая граница

  const layout = (node: TreeNode, x: number): number => {
    const list = kids.get(node.id) ?? [];
    const own = h(node.id);

    if (!list.length) {
      const top = rows.get(x) ?? 0;
      rows.set(x, top + own + ROW_GAP);
      pos.set(node.id, { x, y: Math.round(top) });
      return top + own / 2;
    }

    const centers = list.map((c) => layout(c, x + width + COL_GAP));
    const mid = (centers[0] + centers[centers.length - 1]) / 2;

    // Своя колонка могла уйти ниже середины детей — тогда узел встаёт под нижний
    // край занятого места, иначе он наехал бы на соседа сверху.
    const floor = rows.get(x) ?? 0;
    const top = Math.max(floor, mid - own / 2);
    rows.set(x, top + own + ROW_GAP);
    pos.set(node.id, { x, y: Math.round(top) });
    return top + own / 2;
  };
  layout(root, 0);
  return pos;
}

