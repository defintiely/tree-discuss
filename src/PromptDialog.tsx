import { useEffect, useRef, useState } from 'react';
import { LLM_PROMPT } from './llmPrompt';

export function PromptDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(LLM_PROMPT);
    } catch {
      // Clipboard API недоступен (не тот протокол, нет прав) — выделяем текст,
      // чтобы копирование осталось возможным вручную.
      taRef.current?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="ov" onMouseDown={onClose}>
      <div className="ov-box" onMouseDown={(e) => e.stopPropagation()}>
        <header className="ov-head">
          <strong>Промпт для LLM</strong>
          <span className="ov-hint">
            Скопируй, вставь в любую LLM, а вместо последней строки — свою переписку
          </span>
          <span className="ov-grow" />
          <button className="ov-copy" onClick={copy}>
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
          <button className="ov-x" onClick={onClose} title="Закрыть (Esc)">
            ×
          </button>
        </header>
        <textarea ref={taRef} className="ov-text" readOnly value={LLM_PROMPT} spellCheck={false} />
        <footer className="ov-foot">
          LLM вернёт два блока — <code>nodes.csv</code> и <code>reactions.csv</code>. Сохрани их в
          файлы с такими же именами и загрузи кнопкой «Импорт CSV».
        </footer>
      </div>
    </div>
  );
}
