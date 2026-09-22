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
  const replaceAll = useDoc((s) => s.replaceAll);

  const roomName = useRoom((s) => s.name);
  const password = useRoom((s) => s.password);
  const setSync = useRoom((s) => s.setSync);
  const setUpdatedAt = useRoom((s) => s.setUpdatedAt);
  const markDirty = useRoom((s) => s.markDirty);

  const live = useRef({ nodes, reactions, roomName, password });
  live.current = { nodes, reactions, roomName, password };

  /** Снимок того, что уже лежит в облаке. Пусто — снимка ещё нет. */
  const synced = useRef<string>('');
  const busy = useRef(false);

  const shot = (doc: DocState) => JSON.stringify(doc);

  useEffect(() => {
    if (!roomName) return;
    // Дерево отличается от облачного снимка — значит его правили.
    if (synced.current && shot({ nodes, reactions }) !== synced.current) markDirty();
  }, [nodes, reactions, roomName, markDirty]);

  useEffect(() => {
    if (!roomName || !password) return;
    // Вход: то, что сейчас на экране, и есть содержимое облака.
    synced.current = shot({ nodes: live.current.nodes, reactions: live.current.reactions });

    const tick = async () => {
      const { roomName: room, password: pass, nodes: n, reactions: r } = live.current;
      if (!room || !pass || busy.current) return;
      busy.current = true;
      try {
        const current = shot({ nodes: n, reactions: r });
        if (current !== synced.current) {
          setSync('saving');
          const at = await saveRoom(room, pass, { nodes: n, reactions: r });
          synced.current = current;
          setUpdatedAt(at);
          setSync('saved');
        } else {
          const fresh = await pullIfNewer(room, pass, useRoom.getState().updatedAt);
          if (fresh) {
            synced.current = shot(fresh.doc);
            replaceAll(fresh.doc);
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
