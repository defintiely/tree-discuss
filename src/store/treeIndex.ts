import type { NodeId, TreeNode } from '../types';

type TreeIndex = { byId: Map<NodeId, TreeNode>; kids: Map<NodeId, TreeNode[]> };

const cache = new WeakMap<TreeNode[], TreeIndex>();
const NO_KIDS: TreeNode[] = [];

/**
 * Индекс дерева, один на версию массива узлов. Узлы канваса спрашивают про себя
 * при КАЖДОМ изменении стора — без индекса каждый из них заново пробегал бы все
 * узлы, и перетаскивание одного узла стоило бы квадрат от их числа на кадр.
 */
export function treeIndex(nodes: TreeNode[]): TreeIndex {
  let idx = cache.get(nodes);
  if (idx) return idx;
  const byId = new Map<NodeId, TreeNode>();
  const kids = new Map<NodeId, TreeNode[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    if (!n.parentId) continue;
    const list = kids.get(n.parentId);
    if (list) list.push(n);
    else kids.set(n.parentId, [n]);
  }
  idx = { byId, kids };
  cache.set(nodes, idx);
  return idx;
}

export function childrenOf(nodes: TreeNode[], id: NodeId): TreeNode[] {
  return treeIndex(nodes).kids.get(id) ?? NO_KIDS;
}

/** Закрыт ли кто-то из предков узла: тогда ветка приглушена вместе с ним. */
export function closedAbove(nodes: TreeNode[], id: NodeId): boolean {
  const { byId } = treeIndex(nodes);
  let cur = byId.get(byId.get(id)?.parentId ?? '');
  while (cur) {
    if (cur.closed) return true;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return false;
}
