import { useMemo } from 'react';
import { useDoc } from '../store/useDoc';
import { asAuthor, knownParticipants, useMe } from '../store/useMe';
import { Sheet } from '../ui/Sheet';
import type { NodeId } from '../types';

/**
 * Голосование за закрытие ветки. Голос — мнение, а не замок: закрыть или
 * открыть ветку может любой участник, видя, сколько людей за это высказалось.
 */
export function VotePanel({
  nodeId,
  closedAbove,
  onClose,
}: {
  nodeId: NodeId;
  /** Закрыта ветка выше: эта приглушена вместе с ней, что бы ни решили здесь. */
  closedAbove: boolean;
  onClose: () => void;
}) {
  const nodes = useDoc((s) => s.nodes);
  const participants = useDoc((s) => s.participants);
  const toggleCloseVote = useDoc((s) => s.toggleCloseVote);
  const setClosed = useDoc((s) => s.setClosed);
  const me = useMe((s) => s.name);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const total = useMemo(
    () => knownParticipants(participants, nodes.map((n) => n.author)).length,
    [participants, nodes],
  );
  if (!node) return null;

  const votes = node.closeVotes;
  const mine = Boolean(me) && votes.includes(me);

  return (
    <Sheet title={node.closed ? '🔒 Ветка закрыта' : 'Закрыть ветку?'} onClose={onClose}>
      <p className="sh-note">
        За закрытие — <strong>{votes.length}</strong>
        {total > 0 && <> из {total} {total % 10 === 1 && total % 100 !== 11 ? 'участника' : 'участников'}</>}.
        Решение принимает любой участник.
      </p>

      {votes.length ? (
        <div className="vp-votes">
          {votes.map((v) => (
            <span key={v} className={`vp-chip ${v === me ? 'mine' : ''}`}>
              {v}
            </span>
          ))}
        </div>
      ) : (
        <p className="vp-none">Пока никто не голосовал.</p>
      )}

      {closedAbove && <p className="vp-above">Ветка выше уже закрыта — эта приглушена вместе с ней.</p>}

      <div className="vp-actions">
        <button className="vp-vote" onClick={() => asAuthor((a) => toggleCloseVote(node.id, a))}>
          {mine ? 'Отозвать мой голос' : 'Голосую за закрытие'}
        </button>
        <button
          className={`vp-decide ${node.closed ? 'open' : ''}`}
          onClick={() =>
            asAuthor(() => {
              setClosed(node.id, !node.closed);
              onClose();
            })
          }
        >
          {node.closed ? 'Открыть ветку' : 'Закрыть ветку'}
        </button>
      </div>
    </Sheet>
  );
}
