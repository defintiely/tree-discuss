import { get, set } from 'idb-keyval';
import type { DocState } from '../types';

const KEY = 'tree-discuss-doc';

export async function loadDoc(): Promise<DocState | null> {
  try {
    const raw = await get<DocState>(KEY);
    if (!raw || !Array.isArray(raw.nodes) || !raw.nodes.length) return null;
    return { nodes: raw.nodes, reactions: raw.reactions ?? [] };
  } catch {
    return null;
  }
}

export async function saveDoc(doc: DocState): Promise<void> {
  await set(KEY, doc);
}

export function makeDebouncedSave(delayMs = 500): (doc: DocState) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: DocState | null = null;
  return (doc: DocState) => {
    pending = doc;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pending) void saveDoc(pending);
      pending = null;
    }, delayMs);
  };
}
