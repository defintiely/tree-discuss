import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Карточка поверх канваса: на телефоне выезжает снизу под большой палец,
 * на широком экране стоит по центру.
 *
 * Портал в body обязателен: узлы канваса лежат внутри трансформированного
 * вьюпорта, и position: fixed оттуда считался бы от него, а не от экрана.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return createPortal(
    <div className="sh" onPointerDown={onClose}>
      <div className="sh-box" role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
        <header className="sh-head">
          <strong>{title}</strong>
          <button className="sh-x" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="sh-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
