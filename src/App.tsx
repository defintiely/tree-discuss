import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node as RFNode,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { emptyDoc, useDoc } from './store/useDoc';
import { useMe } from './store/useMe';
import { DiscussNode } from './nodes/DiscussNode';
import { QuoteEdge } from './edges/QuoteEdge';
import { exportDoc } from './csv/serialize';
import { parseDoc } from './csv/parse';
import { loadDoc, makeDebouncedSave } from './storage/persist';
import { PromptDialog } from './PromptDialog';
import { RoomGate } from './rooms/RoomGate';
import { useRoom } from './rooms/useRoom';
import { useSync } from './rooms/useSync';
import { clearRoomInUrl, roomLink } from './rooms/url';
import { layoutTree, MAX_WIDTH, MIN_WIDTH } from './layout';
import { AuthorPicker } from './ui/AuthorPicker';

const nodeTypes = { discuss: DiscussNode };
const edgeTypes = { quote: QuoteEdge };

function Canvas() {
  const nodes = useDoc((s) => s.nodes);
  const reactions = useDoc((s) => s.reactions);
  const participants = useDoc((s) => s.participants);
  const me = useMe((s) => s.name);
  const openPicker = useMe((s) => s.openPicker);
  const width = useDoc((s) => s.width);
  const setWidth = useDoc((s) => s.setWidth);
  const setPos = useDoc((s) => s.setPos);
  const replaceAll = useDoc((s) => s.replaceAll);
  const applyLayout = useDoc((s) => s.applyLayout);
  const [note, setNote] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [menu, setMenu] = useState(false);
  const roomName = useRoom((s) => s.name);
  const roomSync = useRoom((s) => s.sync);
  const roomDirty = useRoom((s) => s.dirty);
  const roomError = useRoom((s) => s.error);
  const leaveRoom = useRoom((s) => s.leave);
  const [copied, setCopied] = useState(false);

  const doc = { nodes, reactions, width, participants };
  const syncText =
    roomSync === 'saving' ? 'сохраняю…' : roomSync === 'error' ? 'ошибка синхронизации' : roomDirty ? 'есть несохранённые правки' : 'всё сохранено';

  function exitRoom() {
    // Дерево чистится ВМЕСТЕ с комнатой: иначе следующая созданная комната
    // унаследует текст предыдущей, а он там чужой.
    leaveRoom();
    clearRoomInUrl();
    replaceAll(emptyDoc(width));
  }

  async function copyLink() {
    if (!roomName) return;
    try { await navigator.clipboard.writeText(roomLink(roomName)); } catch { /* буфер недоступен */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  useSync();
  const filesRef = useRef<HTMLInputElement>(null);
  const save = useMemo(() => makeDebouncedSave(500), []);

  useEffect(() => {
    // В комнате источник правды — облако. Локальная копия подсунула бы старое
    // дерево поверх загруженного и выглядела бы как чужое содержимое.
    if (roomName) return;
    void loadDoc().then((d) => {
      if (d) replaceAll(d);
    });
  }, [replaceAll, roomName]);

  useEffect(() => {
    if (roomName) return;
    save({ nodes, reactions, width, participants });
  }, [nodes, reactions, width, participants, save, roomName]);

  const rfNodes: RFNode[] = useMemo(
    () => nodes.map((n) => ({ id: n.id, type: 'discuss', position: { x: n.x, y: n.y }, data: { nodeId: n.id } })),
    [nodes],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      nodes
        .filter((n) => n.parentId)
        .map((n) => ({
          id: `e-${n.id}`,
          source: n.parentId as string,
          target: n.id,
          type: 'quote',
          data: { anchorStart: n.anchorStart, color: n.color },
          markerEnd: { type: MarkerType.ArrowClosed, color: n.color },
        })),
    [nodes],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) setPos(c.id, c.position.x, c.position.y);
      }
    },
    [setPos],
  );

  const { fitView } = useReactFlow();

  function sortNodes() {
    // Высоты берём из DOM: узлы разной длины, и по оценке крупные наложились бы.
    const heights = new Map<string, number>();
    for (const el of document.querySelectorAll<HTMLElement>('.react-flow__node')) {
      const id = el.dataset.id;
      const h = el.querySelector<HTMLElement>('.dn')?.offsetHeight;
      if (id && h) heights.set(id, h);
    }
    applyLayout(layoutTree(nodes, heights, width));
    setTimeout(() => void fitView({ duration: 400, padding: 0.15 }), 60);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    const pick = (needle: string) => files.find((f) => f.name.toLowerCase().includes(needle));
    const nf = pick('node') ?? files[0];
    const rf = pick('reaction');
    try {
      const parsed = parseDoc(await nf.text(), rf ? await rf.text() : '');
      replaceAll(parsed);
      setNote(`Загружено: ${parsed.nodes.length} узлов, ${parsed.reactions.length} реакций.`);
    } catch (err) {
      setNote(`Импорт не удался. ${(err as Error).message}`);
    }
    e.target.value = '';
  }

  /** Пункт меню: действие и сразу закрыть меню, чтобы канвас освободился. */
  const item = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <div className="app">
      <header className="bar">
        <button
          className={`bar-menu ${menu ? 'on' : ''}`}
          onClick={() => setMenu((v) => !v)}
          aria-label="Меню"
          aria-expanded={menu}
        >
          ☰
        </button>
        <strong className="bar-title" title={roomName ?? undefined}>
          {roomName ?? 'Tree Discuss'}
        </strong>
        {/* Сохранённое состояние молчит: точка появляется, только когда есть о чём сказать. */}
        {roomName && (roomSync === 'saving' || roomSync === 'error' || roomDirty) && (
          <span className={`bar-dot bar-dot-${roomSync}`} title={roomError ?? syncText} />
        )}
        <span className="bar-grow" />
        <button className="bar-me" onClick={() => openPicker()} title="Сменить автора">
          {me || 'Представиться'}
        </button>
      </header>

      {menu && (
        <>
          <div className="menu-veil" onPointerDown={() => setMenu(false)} />
          <nav className="menu">
            {roomName && (
              <section className={`menu-room menu-room-${roomSync}`}>
                <div className="menu-room-name">
                  Комната <strong>{roomName}</strong>
                </div>
                <div className="menu-room-state" title={roomError ?? undefined}>
                  {syncText} · синхронизация раз в 10 секунд
                </div>
                {roomError && <div className="menu-room-err">{roomError}</div>}
                <div className="menu-row">
                  <button onClick={copyLink}>{copied ? '✓ Ссылка скопирована' : 'Скопировать ссылку'}</button>
                  <button onClick={item(exitRoom)}>Выйти</button>
                </div>
              </section>
            )}
            <label className="menu-w" title="Ширина всех узлов на канвасе; в комнате она общая">
              <span>Ширина узлов</span>
              <input
                type="range"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={10}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
              <span className="menu-w-val">{width}</span>
            </label>
            <button onClick={item(sortNodes)}>Разложить дерево</button>
            <button onClick={item(() => setShowPrompt(true))}>Промпт для LLM</button>
            <button onClick={item(() => exportDoc(doc))}>Экспорт CSV</button>
            <button onClick={item(() => filesRef.current?.click())}>Импорт CSV</button>
            <p className="menu-hint">Выдели текст в узле → «Ответить». 🗳 в подвале узла — голос за закрытие ветки.</p>
          </nav>
        </>
      )}
      <input ref={filesRef} type="file" accept=".csv" multiple hidden onChange={onImport} />
      {showPrompt && <PromptDialog onClose={() => setShowPrompt(false)} />}
      <AuthorPicker />
      {note && (
        <div className="note" onClick={() => setNote(null)}>
          {note} <span className="note-x">закрыть</span>
        </div>
      )}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        fitView
        minZoom={0.15}
        maxZoom={2}
        // Двойной тап по тексту узла — правка, а не зум канваса.
        zoomOnDoubleClick={false}
      >
        <Background gap={20} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function App() {
  const roomName = useRoom((s) => s.name);
  const [local, setLocal] = useState(false);

  // Канвас открывается только после входа: иначе работа началась бы в пустоте,
  // и первые же правки некуда было бы сохранять.
  if (!roomName && !local) return <RoomGate onLocal={() => setLocal(true)} />;

  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
