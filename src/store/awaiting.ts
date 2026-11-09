import type { NodeId, Reaction, TreeNode } from '../types';
import { treeIndex } from './treeIndex';

/**
 * Сообщения, которые ждут ответа участника. Ничего не хранится: всё выводится
 * из самого обсуждения, поэтому нотифы одинаковы на всех устройствах человека.
 *
 * Ждёт, если автор не он, в сообщении есть текст, ветка не закрыта (в закрытой
 * отвечать нельзя) и он ещё никак не откликнулся: нет его прямого ответа,
 * его реакции (👀 «видел» — тоже реакция) и его голоса за закрытие.
 *
 * Порядок — обход дерева сверху вниз, дети по высоте на карте: так лента
 * читается в том же порядке, что и сама карта.
 */
export function awaitingMe(nodes: TreeNode[], reactions: Reaction[], me: string): TreeNode[] {
  if (memo && memo.nodes === nodes && memo.reactions === reactions && memo.me === me) return memo.list;
  const list = me ? compute(nodes, reactions, me) : [];
  memo = { nodes, reactions, me, list, ids: new Set(list.map((n) => n.id)) };
  return list;
}

/** Ждёт ли конкретное сообщение — каждый узел спрашивает про себя, поэтому ответ из кэша. */
export function isAwaiting(nodes: TreeNode[], reactions: Reaction[], me: string, id: NodeId): boolean {
  awaitingMe(nodes, reactions, me);
  return memo!.ids.has(id);
}

let memo: { nodes: TreeNode[]; reactions: Reaction[]; me: string; list: TreeNode[]; ids: Set<NodeId> } | null = null;

function compute(nodes: TreeNode[], reactions: Reaction[], me: string): TreeNode[] {
  const { kids } = treeIndex(nodes);
  const reacted = new Set(reactions.filter((r) => r.by.includes(me)).map((r) => r.nodeId));
  const out: TreeNode[] = [];

  const byHeight = (a: TreeNode, b: TreeNode) => a.y - b.y;
  const walk = (n: TreeNode, closed: boolean) => {
    const locked = closed || n.closed;
    const answered =
      n.author === me ||
      !n.text.trim() ||
      reacted.has(n.id) ||
      n.closeVotes.includes(me) ||
      (kids.get(n.id) ?? []).some((c) => c.author === me);
    if (!locked && !answered) out.push(n);
    for (const c of [...(kids.get(n.id) ?? [])].sort(byHeight)) walk(c, locked);
  };
  for (const root of nodes.filter((n) => !n.parentId).sort(byHeight)) walk(root, false);
  return out;
}
