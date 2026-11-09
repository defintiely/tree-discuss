import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDoc } from '../store/useDoc';
import { asAuthor, useMe } from '../store/useMe';
import { awaitingMe, freshResponses, type FreshItem } from '../store/awaiting';
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

/** Свои сообщения с новыми откликами (белый нотиф). */
export function useFresh(): FreshItem[] {
  const nodes = useDoc((s) => s.nodes);
  const reactions = useDoc((s) => s.reactions);
  const me = useMe((s) => s.name);
  return freshResponses(nodes, reactions, me);
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

/**
 * Плашка в шапке: красное — сколько ждут ответа, белое — на сколько своих
 * сообщений пришли новые отклики. Нажатие открывает или прячет ленту.
 */
export function FeedPill({ count, fresh, onClick, open }: { count: number; fresh: number; onClick: () => void; open: boolean }) {
  if (!count && !fresh && !open) return null;
  return (
    <button
      className={`bar-await ${count ? '' : 'none'}`}
      onClick={onClick}
      title={open ? 'Скрыть ленту' : 'Ждут ответа и новые отклики на ваши сообщения'}
    >
      {(count > 0 || !fresh) && (
        <>
          <span className="bar-await-dot" />
          {count}
        </>
      )}
      {fresh > 0 && (
        <span className="bar-fresh">
          <span className="bar-fresh-dot" />
          {fresh}
        </span>
      )}
    </button>
  );
}

/** Подпись строки: первая строка текста узла. */
function firstLine(n: TreeNode): string {
  return n.text.trim().split('\n')[0];
}

function FeedList({ items, fresh, onPick }: { items: TreeNode[]; fresh: FreshItem[]; onPick: () => void }) {
  const rf = useReactFlow();
  const addReaction = useDoc((s) => s.addReaction);
  const ack = useDoc((s) => s.ackResponses);
  const me = useMe((s) => s.name);

  if (!me) return <p className="feed-empty">Представьтесь — и здесь появятся сообщения, которые ждут вашего ответа.</p>;

  return (
    <div className="feed-scroll">
      {items.length ? <WaitList items={items} onPick={onPick} rf={rf} addReaction={addReaction} /> : (
        <p className="feed-empty">Всё отвечено — ничего не ждёт.</p>
      )}
      {fresh.length > 0 && (
        <section className="feed-sec">
          <header className="feed-sec-head">
            <span className="feed-sec-title">
              <span className="feed-fresh-dot" /> Отклики на ваши сообщения · {fresh.length}
            </span>
            <button className="feed-all" onClick={() => ack(fresh.map((f) => f.node.id))}>
              Всё просмотрено
            </button>
          </header>
          <ul className="feed-list">
            {fresh.map(({ node: n, fresh: f }) => (
              <li key={n.id} className="feed-item">
                <button
                  className="feed-go"
                  onClick={() => {
                    ack([n.id]);
                    onPick();
                    flyTo(rf, n.id);
                  }}
                >
                  <span className="feed-resp">{f.map((x) => `${x.who} ${x.what}`).join(', ')}</span>
                  {n.name && <strong className="feed-name">{n.name}</strong>}
                  <span className="feed-text">{firstLine(n)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WaitList({
  items,
  onPick,
  rf,
  addReaction,
}: {
  items: TreeNode[];
  onPick: () => void;
  rf: ReturnType<typeof useReactFlow>;
  addReaction: (id: string, emoji: string, me: string) => void;
}) {
  return (
    <ul className="feed-list">
      {items.map((n) => {
        const line = firstLine(n);
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
export function FeedSide({ items, fresh, onHide }: { items: TreeNode[]; fresh: FreshItem[]; onHide: () => void }) {
  return (
    <aside className="feed">
      <header className="feed-head">
        <strong>Ждут ответа{items.length ? ` · ${items.length}` : ''}</strong>
        <button className="sh-x" onClick={onHide} aria-label="Скрыть ленту" title="Скрыть ленту">
          ×
        </button>
      </header>
      <FeedList items={items} fresh={fresh} onPick={() => {}} />
    </aside>
  );
}

/** Отдельное окно (телефон): тап по сообщению закрывает окно и ведёт к нему. */
export function FeedSheet({ items, fresh, onClose }: { items: TreeNode[]; fresh: FreshItem[]; onClose: () => void }) {
  return (
    <Sheet title={`Ждут ответа${items.length ? ` · ${items.length}` : ''}`} onClose={onClose}>
      <FeedList items={items} fresh={fresh} onPick={onClose} />
    </Sheet>
  );
}
