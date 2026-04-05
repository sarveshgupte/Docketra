// NEW
import { useEffect } from 'react';

const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export const useKeyboardShortcuts = (handlers = {}) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k' && handlers.onCommandPalette) {
        event.preventDefault();
        handlers.onCommandPalette();
        return;
      }

      if ((key === 'j' || key === 'arrowdown') && handlers.onNext) {
        event.preventDefault();
        handlers.onNext();
      } else if ((key === 'k' || key === 'arrowup') && handlers.onPrev) {
        event.preventDefault();
        handlers.onPrev();
      } else if (key === 'enter' && handlers.onOpen) {
        event.preventDefault();
        handlers.onOpen();
      } else if (key === 'e' && handlers.onEdit) {
        event.preventDefault();
        handlers.onEdit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
};
