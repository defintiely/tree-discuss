import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDoc } from '../store/useDoc';
import { asAuthor } from '../store/useMe';
import { sliceText, placeReply } from './segments';
import { KIND_TITLE, type NodeKind, type TreeNode } from '../types';
import { inkFor, lineFor } from '../colors';
import { VotePanel } from './VotePanel';

const PALETTE = ['👍', '👎', '🔥', '🤔', '❤️', '😂', '🎯', '⚠️'];

const KIND_ICON: Record<NodeKind, string> = { root: '◉', reply: '↳', conclusion: '★' };

/** Палец: выделение меняется без mouseup, а над ним висит системное меню «копировать». */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export type DiscussNodeData = { nodeId: string };

function DiscussNodeImpl({ data, selected }: NodeProps) {
  const nodeId = (data as DiscussNodeData).nodeId;
  // Селекторы отдают ТОЛЬКО поля стора: массив, собранный внутри селектора,
  // каждый раз новый по ссылке, и zustand уходит в бесконечный ререндер.
  const allNodes = useDoc((s) => s.nodes);
  const allReactions = useDoc((s) => s.reactions);
  const addReply = useDoc((s) => s.addReply);
  const setText = useDoc((s) => s.setText);
  const setKind = useDoc((s) => s.setKind);
  const bumpReaction = useDoc((s) => s.bumpReaction);
  const removeSubtree = useDoc((s) => s.removeSubtree);
  const subtreeIds = useDoc((s) => s.subtreeIds);
  const setColor = useDoc((s) => s.setColor);
  const width = useDoc((s) => s.width);

  const node = useMemo(() => allNodes.find((n) => n.id === nodeId), [allNodes, nodeId]);
  const children = useMemo(() => allNodes.filter((n) => n.parentId === nodeId), [allNodes, nodeId]);
  const reactions = useMemo(() => allReactions.filter((r) => r.nodeId === nodeId), [allReactions, nodeId]);
  /** Закрыт кто-то из предков: ветка приглушена вместе с ним. */
  const closedAbove = useMemo(() => {
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    let cur = node?.parentId ? byId.get(node.parentId) : undefined;
    while (cur) {
      if (cur.closed) return true;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return false;
  }, [allNodes, node]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState<{ top: number; left: number } | null>(null);
  const [voting, setVoting] = useState(false);
  const [sel, setSel] = useState<{ start: number; end: number; top: number; left: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const locked = Boolean(node?.closed) || closedAbove;

  useLayoutEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [editing]);

  useEffect(() => {
    if (!picker) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.dn-pal') && !t.closest('.dn-add')) setPicker(null);
    };
    const drop = () => setPicker(null);
    // Фаза захвата: канвас гасит события на себе, и обычный слушатель
    // на document клика по пустому месту уже не увидит.
    document.addEventListener('pointerdown', close, true);
    window.addEventListener('wheel', drop, { passive: true });
    window.addEventListener('resize', drop);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      window.removeEventListener('wheel', drop);
      window.removeEventListener('resize', drop);
    };
  }, [picker]);

  useEffect(() => {
    if (!sel) return;
    const drop = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.reply-pop')) setSel(null);
    };
    document.addEventListener('pointerdown', drop);
    return () => document.removeEventListener('pointerdown', drop);
  }, [sel]);

  useEffect(() => {
    // На телефоне выделение тянут ручками, mouseup при этом не приходит —
    // кнопку ответа приходится вешать на само изменение выделения.
    if (!TOUCH || editing || locked) return;
    const onChange = () => setSel(readSelection());
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [editing, locked]);

  if (!node) return null;
  const segments = sliceText(node.text, children);

  /** Смещение в ПОЛНОМ тексте узла: начало сегмента + позиция внутри него. */
  function offsetOf(container: Node, offsetInNode: number): number | null {
    let el: HTMLElement | null =
      container.nodeType === Node.TEXT_NODE
        ? (container.parentElement as HTMLElement | null)
        : (container as HTMLElement);
    while (el && !el.dataset?.segStart) el = el.parentElement;
    if (!el) return null;
    return Number(el.dataset.segStart) + offsetInNode;
  }

  function readSelection(): { start: number; end: number; top: number; left: number } | null {
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0 || !bodyRef.current) return null;
    const range = s.getRangeAt(0);
    if (!bodyRef.current.contains(range.commonAncestorContainer)) return null;

    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    if (a === null || b === null) return null;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end - start < 1) return null;

    const rect = range.getBoundingClientRect();
    const host = bodyRef.current.getBoundingClientRect();
    // Канвас может быть отзумлен: координаты экрана переводятся в координаты узла.
    const scale = host.width / bodyRef.current.offsetWidth || 1;
    const below = (rect.bottom - host.top) / scale + 6;
    // Над первой строкой места нет — кнопка ушла бы под шапку узла и стала некликабельной,
    // поэтому там она встаёт ПОД выделением. Под пальцем — всегда под: сверху
    // висит системное меню выделения и закрыло бы кнопку.
    const above = (rect.top - host.top) / scale - 30;
    const top = TOUCH || above < 2 ? below : above;
    return { start, end, top, left: Math.max(2, (rect.left - host.left) / scale) };
  }

  function onMouseUp() {
    if (editing || locked || TOUCH) return;
    setSel(readSelection());
  }

  function doReply() {
    if (!sel) return;
    const { start, end } = sel;
    setSel(null);
    window.getSelection()?.removeAllRanges();
    asAuthor((me) => {
      const pos = placeReply(node as TreeNode, useDoc.getState().nodes);
      addReply({ parentId: node!.id, anchorStart: start, anchorEnd: end, x: pos.x, y: pos.y, author: me });
    });
  }

  function startEdit(text: string) {
    asAuthor(() => {
      setDraft(text);
      setEditing(true);
    });
  }

  function commit() {
    setText(node!.id, draft);
    setEditing(false);
  }

  function doDelete() {
    asAuthor(() => {
      const count = subtreeIds(node!.id).length;
      const what = count === 1 ? 'Удалить этот узел?' : `Удалить ${count} узлов (узел и все ответы на него)?`;
      if (window.confirm(what)) removeSubtree(node!.id);
    });
  }

  const votes = node.closeVotes.length;

  return (
    <div
      className={`dn dn-${node.kind} ${selected ? 'dn-sel' : ''} ${locked ? 'dn-closed' : ''}`}
      style={{ borderTopColor: lineFor(node.color), width }}
    >
      <Handle type="target" position={Position.Left} className="dn-handle" />
      <header className="dn-head" style={{ background: node.color, color: inkFor(node.color) }}>
        <span className="dn-icon">{KIND_ICON[node.kind]}</span>
        <span className="dn-title">{node.title}</span>
        {node.closed && (
          <button className="dn-lock nodrag" onClick={() => setVoting(true)} title="Ветка закрыта — открыть голосование">
            🔒
          </button>
        )}
        {node.author && (
          <span className="dn-author" title={`Автор: ${node.author}`}>
            {node.author}
          </span>
        )}
        <input
          type="color"
          className="dn-color nodrag"
          value={node.color}
          // Фон ставится явно: у input[type=color] свой светлый вид, и выбранный
          // цвет иначе в квадратике не виден.
          style={{ background: node.color }}
          onChange={(e) => {
            const color = e.target.value;
            asAuthor(() => setColor(node!.id, color));
          }}
          title="Цвет узла и его цитаты"
        />
        <select
          className="dn-kind nodrag"
          value={node.kind}
          onChange={(e) => {
            const kind = e.target.value as NodeKind;
            asAuthor(() => setKind(node!.id, kind));
          }}
          title="Тип узла"
        >
          {(['root', 'reply', 'conclusion'] as NodeKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_TITLE[k]}
            </option>
          ))}
        </select>
        {node.parentId && (
          <button
            className="dn-x nodrag"
            style={{ color: inkFor(node.color) }}
            onClick={doDelete}
            title="Удалить узел и ответы на него"
          >
            ×
          </button>
        )}
      </header>

      {editing ? (
        <textarea
          ref={taRef}
          className="dn-edit nodrag nowheel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commit();
            e.stopPropagation();
          }}
        />
      ) : (
        <div
          ref={bodyRef}
          className="dn-body nodrag nopan"
          // Иначе протяжку внутри текста React Flow забирает себе как жест канваса
          // и выделение не успевает возникнуть.
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={onMouseUp}
          onDoubleClick={() => {
            if (!locked) startEdit(node!.text);
          }}
        >
          {node.text ? (
            segments.map((seg) => (
              <span
                key={seg.start}
                data-seg-start={seg.start}
                className={seg.anchoredBy.length ? 'quoted' : undefined}
                style={
                  seg.anchoredBy.length
                    ? {
                        // Несколько цитат на одном месте: фон последней, а полосы снизу
                        // показывают все — иначе вложенный ответ терял бы свой цвет.
                        background: seg.colors[seg.colors.length - 1],
                        // Пипетка разрешает любой цвет, в том числе тёмный, поэтому
                        // буквы берут контрастный вариант того же оттенка.
                        color: inkFor(seg.colors[seg.colors.length - 1]),
                        boxShadow: seg.colors
                          .map((c, i) => `inset 0 ${-2 - i * 3}px 0 ${lineFor(c)}`)
                          .join(', '),
                        paddingBottom: seg.colors.length > 1 ? seg.colors.length * 3 : undefined,
                      }
                    : undefined
                }
              >
                {seg.text}
              </span>
            ))
          ) : (
            <span className="dn-empty">{locked ? 'Пусто' : 'Двойной клик — написать текст'}</span>
          )}
          {sel && (
            <button
              className="reply-pop nodrag"
              style={{ top: sel.top, left: sel.left }}
              // pointerdown, а не click: к click выделение под пальцем уже сброшено.
              onPointerDown={(e) => {
                e.preventDefault();
                doReply();
              }}
            >
              ↳ Ответить
            </button>
          )}
        </div>
      )}

      <footer className="dn-foot nodrag">
        {reactions.map((r) => (
          <button key={r.emoji} className="dn-r" onClick={() => asAuthor(() => bumpReaction(node!.id, r.emoji, 1))}>
            {r.emoji} {r.count}
          </button>
        ))}
        <div className="dn-pick">
          <button
            ref={addRef}
            className="dn-r dn-add"
            onClick={() => {
              if (picker) return setPicker(null);
              const r = addRef.current?.getBoundingClientRect();
              if (!r) return;
              const W = 250;
              setPicker({
                top: Math.max(8, r.top - 44),
                left: Math.min(Math.max(8, r.left), window.innerWidth - W - 8),
              });
            }}
            title="Добавить реакцию"
          >
            ☺+
          </button>
          {picker &&
            createPortal(
              <div className="dn-pal" style={{ top: picker.top, left: picker.left }}>
                {PALETTE.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setPicker(null);
                      asAuthor(() => bumpReaction(node!.id, e, 1));
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
        <span className="dn-grow" />
        {!locked && (
          <>
            <button
              className="dn-r"
              onClick={() =>
                // Дополнение своей мысли — это НЕ ответ себе: текст дописывается
                // в тот же узел, дерево не растёт лишним узлом.
                startEdit(node!.text ? `${node!.text}\n\n` : '')
              }
              title="Дописать в это сообщение"
            >
              + Дописать
            </button>
            <button
              className="dn-r dn-reply"
              onClick={() =>
                asAuthor((me) => {
                  const pos = placeReply(node as TreeNode, useDoc.getState().nodes);
                  addReply({ parentId: node!.id, x: pos.x, y: pos.y, author: me });
                })
              }
              title="Ответить на весь текст"
            >
              ↳ Ответить
            </button>
          </>
        )}
        <button
          className={`dn-r dn-vote ${votes ? 'has' : ''}`}
          onClick={() => setVoting(true)}
          title={votes ? `За закрытие ветки: ${node.closeVotes.join(', ')}` : 'Голосовать за закрытие ветки'}
        >
          🗳{votes ? ` ${votes}` : ''}
        </button>
      </footer>
      {voting && <VotePanel nodeId={node.id} closedAbove={closedAbove} onClose={() => setVoting(false)} />}
      <Handle type="source" position={Position.Right} className="dn-handle" />
    </div>
  );
}

export const DiscussNode = memo(DiscussNodeImpl);
