import { useState } from 'react';
import { cloudConfigured, createRoom, openRoom } from './api';
import { useRoom } from './useRoom';
import { emptyDoc, useDoc } from '../store/useDoc';
import { roomFromUrl, setRoomInUrl } from './url';

/** Стартовый экран: создать комнату или войти в существующую. */
export function RoomGate({ onLocal }: { onLocal: () => void }) {
  // Комната из ссылки: человеку остаётся ввести только пароль.
  const fromLink = roomFromUrl();

  const [mode, setMode] = useState<'enter' | 'create'>('enter');
  const [name, setName] = useState(fromLink);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useRoom((s) => s.enter);
  const replaceAll = useDoc((s) => s.replaceAll);
  const width = useDoc((s) => s.width);

  const configured = cloudConfigured();
  const invited = Boolean(fromLink) && mode === 'enter';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const room = name.trim();
    if (!room || !password) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        // Дерево берётся ЧИСТОЕ, а не из стора: там могло остаться содержимое
        // комнаты, из которой только что вышли, и оно утекло бы в новую.
        const fresh = emptyDoc(width);
        const at = await createRoom(room, password, fresh);
        replaceAll(fresh);
        setRoomInUrl(room);
        enter(room, password, at);
        return;
      }
      const opened = await openRoom(room, password);
      replaceAll(opened.doc);
      setRoomInUrl(room);
      // Время — серверное: часы браузера отстают, и своя же правка выглядела бы
      // старее облачной, после чего её затирало бы встречное обновление.
      enter(room, password, opened.updatedAt);
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
            {invited ? (
              <p className="gate-invite">
                Комната <strong>{fromLink}</strong> — введите пароль, чтобы войти.
              </p>
            ) : (
              <div className="gate-tabs">
                <button
                  type="button"
                  className={mode === 'enter' ? 'on' : ''}
                  onClick={() => {
                    setMode('enter');
                    setError(null);
                  }}
                >
                  Войти в комнату
                </button>
                <button
                  type="button"
                  className={mode === 'create' ? 'on' : ''}
                  onClick={() => {
                    setMode('create');
                    setError(null);
                  }}
                >
                  Создать комнату
                </button>
              </div>
            )}

            {!invited && (
              <label className="gate-field">
                Название комнаты
                <input
                  autoFocus={!fromLink}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="например, релиз-3"
                />
              </label>
            )}

            <label className="gate-field">
              Пароль
              <input
                type="password"
                autoFocus={Boolean(fromLink)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'придумайте пароль' : 'пароль комнаты'}
              />
            </label>

            {error && <div className="gate-error">{error}</div>}

            <button className="gate-go" type="submit" disabled={busy || !name.trim() || !password}>
              {busy ? 'Минуту…' : mode === 'create' ? 'Создать и войти' : 'Войти'}
            </button>

            {invited && (
              <button
                className="gate-other"
                type="button"
                onClick={() => {
                  setName('');
                  setError(null);
                }}
              >
                Войти в другую комнату
              </button>
            )}

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
