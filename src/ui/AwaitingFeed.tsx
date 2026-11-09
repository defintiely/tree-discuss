import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDoc } from '../store/useDoc';
import { asAuthor, useMe } from '../store/useMe';
import { awaitingMe } from '../store/awaiting';
import { flyTo } from '../nodes/fly';
import { Sheet } from './Sheet';
import type { TreeNode } from '../types';

const KEY = 'tree-discuss-feed';
/** Та же граница, что у Sheet в index.css: уже — лента открывается отдельным окном. */
const PHONE = '(max-width: 600px)';

function loadOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

/** Сообщения, ждущие ответа текущего участника. */
export function useAwaiting(): TreeNode[] {
  const nodes = useDoc((s) => s.nodes);
  const reactions = useDoc((s) => s.reactions);
  const me = useMe((s) => s.name);
  return awaitingMe(nodes, reactions, me);
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/**
 * Состояние ленты. На широком экране она — колонка справа, и скрыта она или нет,
 * помнит браузер. На телефоне колонке места нет: лента — отдельное окно, которое
 * каждый раз открывают плашкой в шапке.
 */
export function useFeed() {
  const phone = usePhone();
  const [side, setSide] = useState(loadOpen);
  const [sheet, setSheet] = useState(false);

  function setSideSaved(v: boolean) {
    setSide(v);
    try {
      localStorage.setItem(KEY, v ? 'open' : 'hidden');
    } catch {
      /* приватный режим — запомнится только в этой вкладке */
    }
  }

  return {
    phone,
    /** Колонка справа видна. */
    sideOpen: !phone && side,
    sheetOpen: phone && sheet,
    toggle: () => (phone ? setSheet((v) => !v) : setSideSaved(!side)),
    hideSide: () => setSideSaved(false),
    closeSheet: () => setSheet(false),
  };
}

/** Плашка в шапке: сколько ждут, нажатие открывает или прячет ленту. */
export function FeedPill({ count, onClick, open }: { count: number; onClick: () => void; open: boolean }) {
  if (!count && !open) return null;
  return (
    <button className={`bar-await ${count ? '' : 'none'}`} onClick={onClick} title={open ? 'Скрыть ленту' : 'Ждут вашего ответа'}>
      <span className="bar-await-dot" />
      {count}
    </button>
  );
}

function FeedList({ items, onPick }: { items: TreeNode[]; onPick: () => void }) {
  const rf = useReactFlow();
  const addReaction = useDoc((s) => s.addReaction);
  const me = useMe((s) => s.name);

  if (!me) return <p className="feed-empty">Представьтесь — и здесь появятся сообщения, которые ждут вашего ответа.</p>;
  if (!items.length) return <p className="feed-empty">Всё отвечено — ничего не ждёт.</p>;

  return (
    <ul className="feed-list">
      {items.map((n) => {
        const line = n.text.trim().split('\n')[0];
        return (
          <li key={n.id} className="feed-item">
            <button
              className="feed-go"
              onClick={() => {
                onPick();
                flyTo(rf, n.id);
              }}
            >
              <span className="feed-who" style={{ background: n.color }}>
                {n.author || 'без автора'}
              </span>
              {n.name && <strong className="feed-name">{n.name}</strong>}
              <span className="feed-text">{line}</span>
            </button>
            <button
              className="feed-seen"
              title="Видел — поставить 👀 и убрать из ленты"
              onClick={() => asAuthor((a) => addReaction(n.id, '👀', a))}
            >
              👀
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Колонка справа (широкий экран). */
export function FeedSide({ items, onHide }: { items: TreeNode[]; onHide: () => void }) {
  return (
    <aside className="feed">
      <header className="feed-head">
        <strong>Ждут ответа{items.length ? ` · ${items.length}` : ''}</strong>
        <button className="sh-x" onClick={onHide} aria-label="Скрыть ленту" title="Скрыть ленту">
          ×
        </button>
      </header>
      <FeedList items={items} onPick={() => {}} />
    </aside>
  );
}

/** Отдельное окно (телефон): тап по сообщению закрывает окно и ведёт к нему. */
export function FeedSheet({ items, onClose }: { items: TreeNode[]; onClose: () => void }) {
  return (
    <Sheet title={`Ждут ответа${items.length ? ` · ${items.length}` : ''}`} onClose={onClose}>
      <FeedList items={items} onPick={onClose} />
    </Sheet>
  );
}
