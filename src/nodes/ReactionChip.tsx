import { useRef } from 'react';
import { useDoc } from '../store/useDoc';
import { asAuthor, useMe } from '../store/useMe';
import { reactionTotal, type Reaction } from '../types';

/** Долгое нажатие пальцем — как правый клик мышью. */
const HOLD_MS = 550;

/**
 * Плашка одной реакции под текстом. Тап — своя реакция: есть — снимается,
 * нет — ставится. Правый клик или долгое нажатие снимает одну безымянную:
 * её автор неизвестен, поэтому снять её может любой участник.
 */
export function ReactionChip({ r }: { r: Reaction }) {
  const toggle = useDoc((s) => s.toggleReaction);
  const dropAnon = useDoc((s) => s.dropAnonReaction);
  const me = useMe((s) => s.name);
  const hold = useRef<number | undefined>(undefined);
  /** Долгое нажатие уже сработало: следующий за ним click — не тап. */
  const held = useRef(false);
  const mine = Boolean(me) && r.by.includes(me);

  function removeAnon() {
    if (r.anon > 0) asAuthor(() => dropAnon(r.nodeId, r.emoji));
  }

  const who = [r.by.join(', '), r.anon ? `без имени: ${r.anon}` : ''].filter(Boolean).join('; ');
  const hint = [
    mine ? 'Нажми, чтобы снять свою реакцию' : 'Нажми, чтобы поставить',
    r.anon ? 'правый клик или долгое нажатие — снять одну безымянную' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      className={`dn-r ${mine ? 'dn-r-mine' : ''}`}
      title={`${who}\n${hint}`}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        asAuthor((a) => toggle(r.nodeId, r.emoji, a));
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!held.current) removeAnon();
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        held.current = false;
        hold.current = window.setTimeout(() => {
          held.current = true;
          removeAnon();
        }, HOLD_MS);
      }}
      onPointerUp={() => clearTimeout(hold.current)}
      onPointerLeave={() => clearTimeout(hold.current)}
      onPointerCancel={() => clearTimeout(hold.current)}
    >
      <span className="dn-r-emo">{r.emoji}</span> {reactionTotal(r)}
    </button>
  );
}
