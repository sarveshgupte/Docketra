import React, { useEffect, useMemo, useRef, useState } from 'react';

export const CommandPalette = ({ isOpen, onClose, commands = [] }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  if (!Array.isArray(commands)) {
    console.error('[CommandPalette] commands prop must be an array', commands);
    return null;
  }

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    return () => clearTimeout(timer);
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
        <input
          ref={inputRef}
          className="command-palette__input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search actions"
        />
        <ul className="command-palette__results">
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
                <span>{command.label}</span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="command-palette__empty">No commands found</li> : null}
        </ul>
      </div>
    </>
  );
};
