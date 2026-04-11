import React, { useEffect, useMemo, useRef, useState } from 'react';

export const CommandPalette = ({ isOpen, onClose, onToggle, commands = [] }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

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
      setSelectedIndex(0);
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

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[aria-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  const handleInputKeyDown = (e) => {
    if (filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    }
  };

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
            onKeyDown={handleInputKeyDown}
            placeholder="Jump to a page or action"
            aria-label="Search commands"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="command-palette-results"
            aria-activedescendant={filtered.length > 0 ? `command-item-${filtered[selectedIndex].id}` : undefined}
          />
          <kbd className="command-palette__shortcut" aria-hidden="true">⌘K</kbd>
        </div>
        <ul id="command-palette-results" ref={listRef} className="command-palette__results" role="listbox" aria-label="Command results">
          {filtered.map((command, index) => (
            <li key={command.id} role="presentation">
              <button
                type="button"
                id={`command-item-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                className={`command-palette__item ${index === selectedIndex ? 'bg-slate-100' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
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
