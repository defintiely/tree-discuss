import Papa from 'papaparse';
import { KIND_TITLE, type DocState, type NodeKind, type Reaction, type TreeNode } from '../types';
import { DEFAULT_COLOR } from '../colors';

const KINDS: NodeKind[] = ['root', 'reply', 'conclusion'];

export function nodesFromCsv(text: string): TreeNode[] {
  const res = Papa.parse<Record<string, string>>(strip(text), {
    header: true,
    skipEmptyLines: true,
  });
  return res.data.map((row, i) => {
    const line = i + 2;
    const id = req(row.id, 'id', line);
    const kind = (row.kind || 'reply').trim() as NodeKind;
    if (!KINDS.includes(kind)) {
      throw new Error(`Строка ${line}: неизвестный тип узла «${row.kind}». Ожидается root, reply или conclusion.`);
    }
    return {
      id,
      parentId: opt(row.parent_id),
      kind,
      title: row.title?.trim() || KIND_TITLE[kind],
      text: row.text ?? '',
      x: num(row.x, 'x', line),
      y: num(row.y, 'y', line),
      anchorStart: optNum(row.anchor_start, 'anchor_start', line),
      anchorEnd: optNum(row.anchor_end, 'anchor_end', line),
      // Файл, выгруженный до появления цвета, читается — цвет берётся по умолчанию.
      color: (row.color ?? '').trim() || DEFAULT_COLOR,
      author: (row.author ?? '').trim(),
      quote: (row.quote ?? '').trim(),
    };
  });
}

export function reactionsFromCsv(text: string): Reaction[] {
  const res = Papa.parse<Record<string, string>>(strip(text), {
    header: true,
    skipEmptyLines: true,
  });
  return res.data.map((row, i) => ({
    nodeId: req(row.node_id, 'node_id', i + 2),
    emoji: req(row.emoji, 'emoji', i + 2),
    count: num(row.count, 'count', i + 2),
  }));
}

export function parseDoc(nodesCsv: string, reactionsCsv: string): DocState {
  const nodes = nodesFromCsv(nodesCsv);
  const reactions = reactionsCsv.trim() ? reactionsFromCsv(reactionsCsv) : [];
  resolveQuotes(nodes);
  validate(nodes, reactions);
  return { nodes, reactions };
}

/**
 * Колонка quote — это цитата ТЕКСТОМ, и она главнее чисел: человек и LLM
 * считают символы с ошибкой, а поиск подстроки не ошибается никогда.
 * Числа остаются для файлов, выгруженных этим приложением.
 */
function resolveQuotes(nodes: TreeNode[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    const q = n.quote?.trim();
    if (!q || !n.parentId) continue;
    const parent = byId.get(n.parentId);
    if (!parent) continue;
    const i = parent.text.indexOf(q);
    if (i >= 0) {
      n.anchorStart = i;
      n.anchorEnd = i + q.length;
      continue;
    }
    // Цитаты нет в тексте родителя: пересказ вместо дословного фрагмента.
    // Числа, если они есть, лучше выдумки — иначе связь остаётся без подсветки.
    if (n.anchorStart === null || n.anchorEnd === null) {
      n.anchorStart = null;
      n.anchorEnd = null;
    }
  }
}

export function validate(nodes: TreeNode[], reactions: Reaction[]): void {
  if (!nodes.length) throw new Error('В файле нет ни одного узла.');

  const byId = new Map<string, TreeNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) throw new Error(`Узел «${n.id}» встречается дважды — id должны быть уникальны.`);
    byId.set(n.id, n);
  }

  for (const n of nodes) {
    if (n.parentId && !byId.has(n.parentId)) {
      throw new Error(`Узел «${n.id}» ссылается на несуществующего родителя «${n.parentId}».`);
    }
    if (n.parentId === n.id) throw new Error(`Узел «${n.id}» указан своим же родителем.`);
  }

  // Цикл ищется ДО подсчёта корней: в цикле корня нет по построению,
  // и проверка корней соврала бы про причину («нет корня» вместо «цикл»).
  for (const start of nodes) {
    const seen = new Set<string>([start.id]);
    let cur = start.parentId ? byId.get(start.parentId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) {
        throw new Error(`Цикл в дереве: узел «${cur.id}» оказывается своим же потомком.`);
      }
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  const roots = nodes.filter((n) => !n.parentId);
  if (!roots.length) throw new Error('Нет корневого узла — ни у одного узла не пустой parent_id.');
  if (roots.length > 1) {
    throw new Error(`Корней должно быть ровно один, найдено ${roots.length}: ${roots.map((r) => r.id).join(', ')}.`);
  }

  for (const r of reactions) {
    if (!byId.has(r.nodeId)) {
      throw new Error(`Реакция «${r.emoji}» повешена на несуществующий узел «${r.nodeId}».`);
    }
  }
}

function strip(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function req(v: string | undefined, col: string, line: number): string {
  const s = (v ?? '').trim();
  if (!s) throw new Error(`Строка ${line}: пустое обязательное поле «${col}».`);
  return s;
}

function opt(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return s ? s : null;
}

function num(v: string | undefined, col: string, line: number): number {
  const n = Number((v ?? '').trim());
  if (!Number.isFinite(n)) throw new Error(`Строка ${line}: «${col}» должно быть числом, получено «${v}».`);
  return n;
}

function optNum(v: string | undefined, col: string, line: number): number | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  return num(s, col, line);
}
