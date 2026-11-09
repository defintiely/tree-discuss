import Papa from 'papaparse';
import { reactionTotal, type DocState, type Reaction, type TreeNode } from '../types';

const BOM = '﻿';

export function nodesToCsv(nodes: TreeNode[]): string {
  const rows = nodes.map((n) => ({
    id: n.id,
    parent_id: n.parentId ?? '',
    kind: n.kind,
    title: n.title,
    name: n.name,
    text: n.text,
    x: Math.round(n.x),
    y: Math.round(n.y),
    anchor_start: n.anchorStart ?? '',
    anchor_end: n.anchorEnd ?? '',
    color: n.color,
    author: n.author,
    quote: n.quote,
    closed: n.closed ? 1 : '',
  }));
  return Papa.unparse(rows, {
    columns: ['id', 'parent_id', 'kind', 'title', 'name', 'text', 'x', 'y', 'anchor_start', 'anchor_end', 'color', 'author', 'quote', 'closed'],
  });
}

export function reactionsToCsv(reactions: Reaction[]): string {
  // count — сколько всего поставили (так его понимает и LLM), by — ники через «;»;
  // безымянные при чтении восстанавливаются как count минус ники.
  const rows = reactions.map((r) => ({ node_id: r.nodeId, emoji: r.emoji, count: reactionTotal(r), by: r.by.join(';') }));
  return Papa.unparse(rows, { columns: ['node_id', 'emoji', 'count', 'by'] });
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDoc(doc: DocState): void {
  downloadCsv('nodes.csv', nodesToCsv(doc.nodes));
  downloadCsv('reactions.csv', reactionsToCsv(doc.reactions));
}
