import Papa from 'papaparse';
import type { DocState, Reaction, TreeNode } from '../types';

const BOM = '﻿';

export function nodesToCsv(nodes: TreeNode[]): string {
  const rows = nodes.map((n) => ({
    id: n.id,
    parent_id: n.parentId ?? '',
    kind: n.kind,
    title: n.title,
    text: n.text,
    x: Math.round(n.x),
    y: Math.round(n.y),
    anchor_start: n.anchorStart ?? '',
    anchor_end: n.anchorEnd ?? '',
    color: n.color,
    author: n.author,
    quote: n.quote,
  }));
  return Papa.unparse(rows, {
    columns: ['id', 'parent_id', 'kind', 'title', 'text', 'x', 'y', 'anchor_start', 'anchor_end', 'color', 'author', 'quote'],
  });
}

export function reactionsToCsv(reactions: Reaction[]): string {
  const rows = reactions.map((r) => ({ node_id: r.nodeId, emoji: r.emoji, count: r.count }));
  return Papa.unparse(rows, { columns: ['node_id', 'emoji', 'count'] });
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
