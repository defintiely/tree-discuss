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
import { useDoc } from './store/useDoc';
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
import { layoutTree, MAX_WIDTH, MIN_WIDTH } from './layout';

const nodeTypes = { discuss: DiscussNode };
const edgeTypes = { quote: QuoteEdge };

function Canvas() {
  const nodes = useDoc((s) => s.nodes);
  const reactions = useDoc((s) => s.reactions);
  const me = useMe((s) => s.name);
  const setMe = useMe((s) => s.setName);
  const width = useMe((s) => s.width);
  const setWidth = useMe((s) => s.setWidth);
  const setPos = useDoc((s) => s.setPos);
  const replaceAll = useDoc((s) => s.replaceAll);
  const applyLayout = useDoc((s) => s.applyLayout);
  const [note, setNote] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const roomName = useRoom((s) => s.name);
  const roomSync = useRoom((s) => s.sync);
  const roomDirty = useRoom((s) => s.dirty);
  const roomError = useRoom((s) => s.error);
  const leaveRoom = useRoom((s) => s.leave);
  useSync();
  const filesRef = useRef<HTMLInputElement>(null);
  const save = useMemo(() => makeDebouncedSave(500), []);

  useEffect(() => {
    void loadDoc().then((doc) => {
      if (doc) replaceAll(doc);
    });
  }, [replaceAll]);

  useEffect(() => {
    save({ nodes, reactions });
  }, [nodes, reactions, save]);

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
      const doc = parseDoc(await nf.text(), rf ? await rf.text() : '');
      replaceAll(doc);
      setNote(`Загружено: ${doc.nodes.length} узлов, ${doc.reactions.length} реакций.`);
    } catch (err) {
      setNote(`Импорт не удался. ${(err as Error).message}`);
    }
    e.target.value = '';
  }

  return (
    <div className="app">
      <div className="bar">
        <strong>Tree Discuss</strong>
        <span className="bar-hint">Выдели текст в узле → «Ответить»</span>
        <span className="bar-grow" />
        {roomName && (
          <span className={`bar-room bar-room-${roomSync}`} title={roomError ?? "Комната синхронизируется каждые 10 секунд"}>
            <strong>{roomName}</strong>
            <span className="bar-room-state">
              {roomSync === "saving" ? "сохраняю…" : roomSync === "error" ? "ошибка" : roomDirty ? "есть правки" : "сохранено"}
            </span>
            <button className="bar-room-out" onClick={leaveRoom} title="Выйти из комнаты">выйти</button>
          </span>
        )}
        <label className="bar-me">
          Я:
          <input
            type="text"
            value={me}
            placeholder="ваш ник"
            onChange={(e) => setMe(e.target.value)}
            title="Ник, которым помечаются созданные вами узлы"
          />
        </label>
        <label className="bar-w" title="Ширина всех узлов на канвасе">
          Ширина:
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
          <span className="bar-w-val">{width}</span>
        </label>
        <button onClick={sortNodes} title="Разложить дерево по колонкам: уровень ответа — колонка, порядок — по позиции цитаты">
          Разложить
        </button>
        <button onClick={() => setShowPrompt(true)} title="Промпт, которым LLM превратит переписку в CSV">
          Промпт для LLM
        </button>
        <button onClick={() => exportDoc({ nodes, reactions })}>Экспорт CSV</button>
        <button onClick={() => filesRef.current?.click()}>Импорт CSV</button>
        <input ref={filesRef} type="file" accept=".csv" multiple hidden onChange={onImport} />
      </div>
      {showPrompt && <PromptDialog onClose={() => setShowPrompt(false)} />}
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
