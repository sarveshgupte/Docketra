import React, { useEffect, useMemo, useRef, useState } from 'react';

export const CommandPalette = ({ isOpen, onClose, onToggle, commands = [] }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  if (!Array.isArray(commands)) {
    console.error('[CommandPalette] commands prop must be an array', commands);
    return null;
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onToggle?.();
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onToggle]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen]);

  const validCommands = useMemo(
    () => commands.filter((command) => {
      if (!command?.id || !command?.label) {
        console.warn('[CommandPalette] Invalid command:', command);
        return false;
      }
      return true;
    }),
    [commands]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return validCommands;
    const term = query.toLowerCase();
    return validCommands.filter((command) => command.label.toLowerCase().includes(term));
  }, [validCommands, query]);

  if (!isOpen) return null;

  return (
    <>
      <button type="button" className="command-palette__overlay" onClick={onClose} aria-label="Close command palette" />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-palette__header">
          <input
            ref={inputRef}
            className="command-palette__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page or action"
            aria-label="Search commands"
          />
          <kbd className="command-palette__shortcut" aria-hidden="true">⌘K</kbd>
        </div>
        <ul className="command-palette__results" role="listbox" aria-label="Command results">
          {filtered.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="command-palette__item"
                onClick={() => {
                  command.action();
                  onClose();
                }}
              >
                <span className="command-palette__item-label">{command.label}</span>
                {command.shortcut ? <kbd className="command-palette__item-shortcut">{command.shortcut}</kbd> : null}
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="command-palette__empty">No actions match your search.</li> : null}
        </ul>
      </div>
    </>
  );
};
