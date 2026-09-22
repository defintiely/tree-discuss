import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDoc } from '../store/useDoc';
import { useMe } from '../store/useMe';
import { sliceText, placeReply } from './segments';
import { KIND_TITLE, type NodeKind, type TreeNode } from '../types';
import { inkFor, lineFor } from '../colors';

const PALETTE = ['👍', '👎', '🔥', '🤔', '❤️', '😂', '🎯', '⚠️'];

const KIND_ICON: Record<NodeKind, string> = { root: '◉', reply: '↳', conclusion: '★' };

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
  const me = useMe((s) => s.name);
  const width = useMe((s) => s.width);

  const node = useMemo(() => allNodes.find((n) => n.id === nodeId), [allNodes, nodeId]);
  const children = useMemo(() => allNodes.filter((n) => n.parentId === nodeId), [allNodes, nodeId]);
  const reactions = useMemo(() => allReactions.filter((r) => r.nodeId === nodeId), [allReactions, nodeId]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState<{ top: number; left: number } | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number; top: number; left: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [editing]);

  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.dn-pal') && !t.closest('.dn-add')) setPicker(null);
    };
    const drop = () => setPicker(null);
    // Фаза захвата: канвас гасит события на себе, и обычный слушатель
    // на document клика по пустому месту уже не увидит.
    document.addEventListener('mousedown', close, true);
    window.addEventListener('wheel', drop, { passive: true });
    window.addEventListener('resize', drop);
    return () => {
      document.removeEventListener('mousedown', close, true);
      window.removeEventListener('wheel', drop);
      window.removeEventListener('resize', drop);
    };
  }, [picker]);

  useEffect(() => {
    if (!sel) return;
    const drop = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reply-pop')) setSel(null);
    };
    document.addEventListener('mousedown', drop);
    return () => document.removeEventListener('mousedown', drop);
  }, [sel]);

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

  function onMouseUp() {
    if (editing) return;
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0) return setSel(null);
    const range = s.getRangeAt(0);
    if (!bodyRef.current?.contains(range.commonAncestorContainer)) return setSel(null);

    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    if (a === null || b === null) return setSel(null);
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end - start < 1) return setSel(null);

    const rect = range.getBoundingClientRect();
    const host = bodyRef.current.getBoundingClientRect();
    // Над первой строкой места нет — кнопка ушла бы под шапку узла и стала некликабельной,
    // поэтому там она встаёт ПОД выделением.
    const above = rect.top - host.top - 30;
    const top = above >= 2 ? above : rect.bottom - host.top + 6;
    setSel({ start, end, top, left: Math.max(2, rect.left - host.left) });
  }

  function doReply() {
    if (!sel) return;
    const pos = placeReply(node as TreeNode, allNodes);
    addReply({ parentId: node!.id, anchorStart: sel.start, anchorEnd: sel.end, x: pos.x, y: pos.y, author: me });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  function commit() {
    setText(node!.id, draft);
    setEditing(false);
  }

  function doDelete() {
    const count = subtreeIds(node!.id).length;
    const what = count === 1 ? 'Удалить этот узел?' : `Удалить ${count} узлов (узел и все ответы на него)?`;
    if (window.confirm(what)) removeSubtree(node!.id);
  }

  return (
    <div
      className={`dn dn-${node.kind} ${selected ? 'dn-sel' : ''}`}
      style={{ borderTopColor: lineFor(node.color), width }}
    >
      <Handle type="target" position={Position.Left} className="dn-handle" />
      <header className="dn-head" style={{ background: node.color, color: inkFor(node.color) }}>
        <span className="dn-icon">{KIND_ICON[node.kind]}</span>
        <span className="dn-title">{node.title}</span>
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
          onChange={(e) => setColor(node!.id, e.target.value)}
          title="Цвет узла и его цитаты"
        />
        <select
          className="dn-kind nodrag"
          value={node.kind}
          onChange={(e) => setKind(node!.id, e.target.value as NodeKind)}
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
            setDraft(node!.text);
            setEditing(true);
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
            <span className="dn-empty">Двойной клик — написать текст</span>
          )}
          {sel && (
            <button className="reply-pop nodrag" style={{ top: sel.top, left: sel.left }} onMouseDown={doReply}>
              ↳ Ответить
            </button>
          )}
        </div>
      )}

      <footer className="dn-foot nodrag">
        {reactions.map((r) => (
          <button key={r.emoji} className="dn-r" onClick={() => bumpReaction(node!.id, r.emoji, 1)}>
            {r.emoji} {r.count}
          </button>
        ))}
        <button
          className="dn-r dn-append"
          onClick={() => {
            // Дополнение своей мысли — это НЕ ответ себе: текст дописывается
            // в тот же узел, дерево не растёт лишним узлом.
            setDraft(node!.text ? `${node!.text}\n\n` : '');
            setEditing(true);
          }}
          title="Дописать в это сообщение"
        >
          + Дописать
        </button>
        <button
          className="dn-r dn-reply"
          onClick={() => {
            const pos = placeReply(node as TreeNode, allNodes);
            addReply({ parentId: node!.id, x: pos.x, y: pos.y, author: me });
          }}
          title="Ответить на весь текст"
        >
          ↳ Ответить
        </button>
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
                      bumpReaction(node!.id, e, 1);
                      setPicker(null);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
      </footer>
      <Handle type="source" position={Position.Right} className="dn-handle" />
    </div>
  );
}

export const DiscussNode = memo(DiscussNodeImpl);
