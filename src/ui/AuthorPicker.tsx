import { useMemo, useState } from 'react';
import { useDoc } from '../store/useDoc';
import { knownParticipants, useMe } from '../store/useMe';
import { Sheet } from './Sheet';

/** Выбор, от чьего имени идут правки: участник обсуждения или новый. */
export function AuthorPicker() {
  const picking = useMe((s) => s.picking);
  const pending = useMe((s) => s.pending);
  const closePicker = useMe((s) => s.closePicker);
  const me = useMe((s) => s.name);
  const setName = useMe((s) => s.setName);
  const participants = useDoc((s) => s.participants);
  const nodes = useDoc((s) => s.nodes);
  const addParticipant = useDoc((s) => s.addParticipant);
  const [draft, setDraft] = useState('');

  const known = useMemo(() => knownParticipants(participants, nodes.map((n) => n.author)), [participants, nodes]);
  // Ник из прошлой комнаты предлагается первым: продолжить под ним — один тап.
  const options = me && !known.includes(me) ? [me, ...known] : known;

  if (!picking) return null;

  function choose(raw: string) {
    const typed = raw.trim();
    if (!typed) return;
    // «Петя» и «петя» — один человек: иначе голос раздваивался бы на два ника.
    const name = options.find((p) => p.toLowerCase() === typed.toLowerCase()) ?? typed;
    const then = pending;
    setName(name);
    addParticipant(name);
    closePicker();
    setDraft('');
    then?.(name);
  }

  return (
    <Sheet title={pending ? 'Кто вы в этом обсуждении?' : 'Автор'} onClose={closePicker}>
      <p className="sh-note">
        {pending
          ? 'Правки и голоса подписываются ником. Выберите себя или добавьте нового участника.'
          : 'От этого имени подписываются правки и голоса.'}
      </p>
      {options.length > 0 && (
        <div className="ap-list">
          {options.map((p) => (
            <button key={p} className={`ap-item ${p === me ? 'on' : ''}`} onClick={() => choose(p)}>
              <span className="ap-name">{p}</span>
              {p === me && <span className="ap-me">это вы</span>}
            </button>
          ))}
        </div>
      )}
      <form
        className="ap-new"
        onSubmit={(e) => {
          e.preventDefault();
          choose(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="новый участник"
          maxLength={40}
          autoFocus={!options.length}
        />
        <button type="submit" disabled={!draft.trim()}>
          Добавить
        </button>
      </form>
    </Sheet>
  );
}
