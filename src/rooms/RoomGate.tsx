import { useState } from 'react';
import { cloudConfigured, createRoom, openRoom } from './api';
import { useRoom } from './useRoom';
import { useDoc } from '../store/useDoc';
import type { DocState } from '../types';

/** Стартовый экран: создать комнату или войти в существующую. */
export function RoomGate({ onLocal }: { onLocal: () => void }) {
  const [mode, setMode] = useState<'enter' | 'create'>('enter');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useRoom((s) => s.enter);
  const replaceAll = useDoc((s) => s.replaceAll);
  const nodes = useDoc((s) => s.nodes);

  const configured = cloudConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const room = name.trim();
    if (!room || !password) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        // Новая комната начинается с одного корневого узла, а не с копии
        // того, что случайно осталось на экране от прошлой работы.
        const fresh: DocState = { nodes: [nodes[0]], reactions: [] };
        await createRoom(room, password, fresh);
        replaceAll(fresh);
      } else {
        replaceAll(await openRoom(room, password));
      }
      enter(room, password, new Date().toISOString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate-box" onSubmit={submit}>
        <h1 className="gate-title">Tree Discuss</h1>
        <p className="gate-sub">Обсуждение деревом: ответ цепляется за конкретную фразу.</p>

        {configured ? (
          <>
            <div className="gate-tabs">
              <button
                type="button"
                className={mode === 'enter' ? 'on' : ''}
                onClick={() => { setMode('enter'); setError(null); }}
              >
                Войти в комнату
              </button>
              <button
                type="button"
                className={mode === 'create' ? 'on' : ''}
                onClick={() => { setMode('create'); setError(null); }}
              >
                Создать комнату
              </button>
            </div>

            <label className="gate-field">
              Название комнаты
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="например, релиз-3"
              />
            </label>

            <label className="gate-field">
              Пароль
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'придумайте пароль' : 'пароль комнаты'}
              />
            </label>

            {error && <div className="gate-error">{error}</div>}

            <button className="gate-go" type="submit" disabled={busy || !name.trim() || !password}>
              {busy ? 'Минуту…' : mode === 'create' ? 'Создать и войти' : 'Войти'}
            </button>

            <p className="gate-note">
              Пароль не уходит в облако, а содержимое комнаты шифруется им же. Забытый пароль
              восстановить нельзя — комната останется нечитаемой.
            </p>
          </>
        ) : (
          <div className="gate-error">
            Облако не настроено в этой сборке: нет адреса базы. Работать можно только локально.
          </div>
        )}

        <button className="gate-local" type="button" onClick={onLocal}>
          Работать без комнаты, в этом браузере
        </button>
      </form>
    </div>
  );
}
