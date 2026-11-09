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

/**
 * Отклики других на узел: реакции с ником («r:👍:Оля») и голоса за закрытие
 * («v:Оля»). Безымянные реакции откликами не считаются — неизвестно, чьи они
 * и когда появились.
 */
export function responseKeys(n: TreeNode, reactions: Reaction[]): string[] {
  const keys: string[] = [];
  for (const r of reactions) {
    if (r.nodeId !== n.id) continue;
    for (const who of r.by) if (who !== n.author) keys.push(`r:${r.emoji}:${who}`);
  }
  for (const who of n.closeVotes) if (who !== n.author) keys.push(`v:${who}`);
  return keys;
}

/** Новый отклик для строки ленты: кто и чем. */
export type Fresh = { who: string; what: string };
export type FreshItem = { node: TreeNode; fresh: Fresh[] };

/**
 * Свои сообщения с откликами, которых автор ещё не видел (белый нотиф).
 * Порядок — тот же обход дерева, что у ленты ждущих.
 */
export function freshResponses(nodes: TreeNode[], reactions: Reaction[], me: string): FreshItem[] {
  if (fmemo && fmemo.nodes === nodes && fmemo.reactions === reactions && fmemo.me === me) return fmemo.list;
  const list: FreshItem[] = [];
  if (me) {
    for (const n of treeOrder(nodes)) {
      if (n.author !== me) continue;
      const fresh = responseKeys(n, reactions)
        .filter((k) => !n.seen.includes(k))
        .map((k): Fresh => {
          const [kind, ...rest] = k.split(':');
          return kind === 'v' ? { who: rest.join(':'), what: '🗳' } : { who: rest.slice(1).join(':'), what: rest[0] };
        });
      if (fresh.length) list.push({ node: n, fresh });
    }
  }
  fmemo = { nodes, reactions, me, list, ids: new Set(list.map((f) => f.node.id)) };
  return list;
}

/** Есть ли у узла непросмотренные отклики — каждый узел спрашивает про себя, ответ из кэша. */
export function hasFresh(nodes: TreeNode[], reactions: Reaction[], me: string, id: NodeId): boolean {
  freshResponses(nodes, reactions, me);
  return fmemo!.ids.has(id);
}

let fmemo: { nodes: TreeNode[]; reactions: Reaction[]; me: string; list: FreshItem[]; ids: Set<NodeId> } | null = null;

/** Все узлы обходом дерева сверху вниз, дети — по высоте на карте. */
function treeOrder(nodes: TreeNode[]): TreeNode[] {
  const { kids } = treeIndex(nodes);
  const out: TreeNode[] = [];
  const byHeight = (a: TreeNode, b: TreeNode) => a.y - b.y;
  const walk = (n: TreeNode) => {
    out.push(n);
    for (const c of [...(kids.get(n.id) ?? [])].sort(byHeight)) walk(c);
  };
  for (const root of nodes.filter((n) => !n.parentId).sort(byHeight)) walk(root);
  return out;
}

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
