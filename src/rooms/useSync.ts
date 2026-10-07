import { useEffect, useRef } from 'react';
import { pullIfNewer, saveRoom } from './api';
import { useRoom } from './useRoom';
import { useDoc } from '../store/useDoc';
import type { DocState } from '../types';

const PERIOD_MS = 10_000;

/**
 * Синхронизация комнаты: раз в 10 секунд отдаёт свои правки, а когда их нет —
 * забирает чужие.
 *
 * «Изменилось ли дерево» определяется СРАВНЕНИЕМ с последним синхронизированным
 * снимком, а не порядком срабатывания эффектов: порядок зависит от React и
 * однажды уже съел настоящую правку, приняв её за загрузку.
 */
export function useSync() {
  const nodes = useDoc((s) => s.nodes);
  const reactions = useDoc((s) => s.reactions);
  const width = useDoc((s) => s.width);
  const participants = useDoc((s) => s.participants);
  const replaceAll = useDoc((s) => s.replaceAll);

  const roomName = useRoom((s) => s.name);
  const password = useRoom((s) => s.password);
  const setSync = useRoom((s) => s.setSync);
  const setUpdatedAt = useRoom((s) => s.setUpdatedAt);
  const markDirty = useRoom((s) => s.markDirty);

  // Документ собирается в ОДНОМ месте: поле, забытое здесь, не уходило бы в облако
  // и молча терялось у всех остальных.
  const doc: DocState = { nodes, reactions, width, participants };
  const live = useRef({ doc, roomName, password });
  live.current = { doc, roomName, password };

  /**
   * Документ, который уже лежит в облаке. Сравнивается ПО ССЫЛКАМ полей: стор
   * неизменяемый, любая правка даёт новый массив. Сериализация всего документа
   * на каждое изменение стоила бы JSON всего дерева на каждый кадр перетаскивания.
   */
  const synced = useRef<DocState | null>(null);
  const busy = useRef(false);

  const same = (a: DocState, b: DocState | null) =>
    !!b && a.nodes === b.nodes && a.reactions === b.reactions && a.width === b.width && a.participants === b.participants;

  useEffect(() => {
    if (!roomName) return;
    // Дерево отличается от облачного снимка — значит его правили.
    if (synced.current && !same({ nodes, reactions, width, participants }, synced.current)) markDirty();
  }, [nodes, reactions, width, participants, roomName, markDirty]);

  useEffect(() => {
    if (!roomName || !password) return;
    // Вход: то, что сейчас на экране, и есть содержимое облака.
    synced.current = live.current.doc;

    const tick = async () => {
      const { roomName: room, password: pass, doc: d } = live.current;
      if (!room || !pass || busy.current) return;
      busy.current = true;
      try {
        if (!same(d, synced.current)) {
          setSync('saving');
          const at = await saveRoom(room, pass, d);
          synced.current = d;
          setUpdatedAt(at);
          setSync('saved');
        } else {
          const fresh = await pullIfNewer(room, pass, useRoom.getState().updatedAt);
          if (fresh) {
            replaceAll(fresh.doc);
            // Снимок — то, что реально оказалось в сторе после нормализации.
            const s = useDoc.getState();
            synced.current = { nodes: s.nodes, reactions: s.reactions, width: s.width, participants: s.participants };
            setUpdatedAt(fresh.updatedAt);
            setSync('saved');
          }
        }
      } catch (err) {
        setSync('error', (err as Error).message);
      } finally {
        busy.current = false;
      }
    };

    const id = setInterval(tick, PERIOD_MS);
    return () => clearInterval(id);
  }, [roomName, password, replaceAll, setSync, setUpdatedAt]);
}
