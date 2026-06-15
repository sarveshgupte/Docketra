import React, { useEffect, useMemo, useRef, useState } from 'react';
import './CommandPalette.css';

const getCommandsFromSections = (sections = []) => sections.flatMap((section) => section.items || []);

export const CommandPalette = ({
  isOpen,
  onClose,
  commands = [],
  sections,
  queryPlaceholder = 'Jump to a page or action',
  helperText = 'Type to filter commands',
  query: controlledQuery,
  onQueryChange,
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingActionId, setPendingActionId] = useState(null);
  const inputRef = useRef(null);
  const itemRefs = useRef([]);
  const lastInteractionRef = useRef('mouse');

  const query = typeof controlledQuery === 'string' ? controlledQuery : internalQuery;
  const setQuery = onQueryChange || setInternalQuery;

  if (!Array.isArray(commands)) {
    console.error('[CommandPalette] commands prop must be an array', commands);
    return null;
  }

  const preparedSections = useMemo(() => {
    if (Array.isArray(sections) && sections.length > 0) {
      return sections
        .map((section) => ({
          ...section,
          items: Array.isArray(section?.items) ? section.items.filter((command) => command?.id && command?.label) : [],
        }))
        .filter((section) => section.items.length > 0);
    }

    const filteredCommands = commands.filter((command) => {
      if (!command?.id || !command?.label) {
        console.warn('[CommandPalette] Invalid command:', command);
        return false;
      }
      return true;
    });

    return [{ id: 'commands', label: 'Commands', items: filteredCommands }];
  }, [commands, sections]);

  const visibleSections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return preparedSections;

    return preparedSections
      .map((section) => ({
        ...section,
        items: section.items.filter((command) => {
          const haystack = [command.label, command.description, command.group]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [preparedSections, query]);

  const visibleItems = useMemo(() => getCommandsFromSections(visibleSections), [visibleSections]);

  useEffect(() => {
    if (!visibleItems.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((previous) => Math.min(previous, visibleItems.length - 1));
  }, [visibleItems]);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(0);
      setPendingActionId(null);
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen]);

  const executeCommand = async (command) => {
    if (!command) return;
    await Promise.resolve(command.action?.());
    onClose?.();
  };

  const executeSecondaryAction = async (command) => {
    if (!command?.secondaryAction?.action) return;
    setPendingActionId(command.id);
    try {
      await Promise.resolve(command.secondaryAction.action());
      if (command.secondaryAction.closeOnSelect !== false) {
        onClose?.();
      }
    } finally {
      setPendingActionId(null);
    }
  };

  const handleInputKeyDown = (event) => {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      lastInteractionRef.current = 'keyboard';
      setActiveIndex((index) => (visibleItems.length ? Math.min(index + 1, visibleItems.length - 1) : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      lastInteractionRef.current = 'keyboard';
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (!visibleItems[activeIndex]) return;
      event.preventDefault();
      if (event.altKey && visibleItems[activeIndex]?.secondaryAction?.action) {
        void executeSecondaryAction(visibleItems[activeIndex]);
        return;
      }
      void executeCommand(visibleItems[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (lastInteractionRef.current === 'keyboard') {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  let itemOffset = 0;

  return (
    <>
      <button type="button" className="command-palette__overlay" onClick={onClose} aria-label="Close command palette" />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command center" onKeyDown={handleInputKeyDown}>
        <div className="command-palette__header">
          <div className="command-palette__input-shell">
            <svg className="command-palette__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              className="command-palette__input"
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-results"
              aria-activedescendant={visibleItems[activeIndex] ? `command-option-${visibleItems[activeIndex].id}` : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={queryPlaceholder}
              aria-label="Search commands"
            />
            {query ? (
              <button type="button" className="command-palette__clear" onClick={() => setQuery('')} aria-label="Clear command search">
                Clear
              </button>
            ) : null}
          </div>
          <button type="button" className="command-palette__close" onClick={onClose} aria-label="Close command center">
            Esc
          </button>
        </div>
        <div className="command-palette__helper">
          <span>{helperText}</span>
          <span>{visibleItems.length ? `${visibleItems.length} matches` : 'Type to search'}</span>
        </div>
        <ul id="command-palette-results" className="command-palette__results" role="listbox" aria-label="Command results">
          {visibleSections.map((section) => {
            const sectionStart = itemOffset;
            itemOffset += section.items.length;
            return (
              <li key={section.id} className="command-palette__section">
                <p className="command-palette__section-label">{section.label}</p>
                <ul className="command-palette__section-items" role="presentation">
                  {section.items.map((command, index) => {
                    const visibleIndex = sectionStart + index;
                    const active = visibleIndex === activeIndex;
                    return (
                      <li key={command.id}>
                        <button
                          type="button"
                          id={`command-option-${command.id}`}
                          ref={(element) => {
                            itemRefs.current[visibleIndex] = element;
                          }}
                          className={`command-palette__item ${active ? 'command-palette__item--active' : ''}`}
                          onClick={() => { void executeCommand(command); }}
                          onMouseEnter={() => {
                            lastInteractionRef.current = 'mouse';
                            setActiveIndex(visibleIndex);
                          }}
                          role="option"
                          aria-selected={active}
                        >
                          <span className="command-palette__item-content">
                            <span className="command-palette__item-label">{command.label}</span>
                            {command.description ? <span className="command-palette__item-description">{command.description}</span> : null}
                          </span>
                          <span className="command-palette__item-affordances">
                            {Array.isArray(command.meta) && command.meta.length > 0
                              ? command.meta.map((meta) => (
                                <span key={`${command.id}-${meta}`} className="command-palette__item-meta">
                                  {meta}
                                </span>
                              ))
                              : null}
                            {command.secondaryAction?.label ? (
                              <button
                                type="button"
                                className="command-palette__item-secondary"
                                disabled={pendingActionId === command.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void executeSecondaryAction(command);
                                }}
                                aria-label={command.secondaryAction.ariaLabel || command.secondaryAction.label}
                              >
                                {pendingActionId === command.id ? 'Pulling…' : command.secondaryAction.label}
                              </button>
                            ) : null}
                            {command.shortcut ? <kbd className="command-palette__item-shortcut">{command.shortcut}</kbd> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {!visibleItems.length ? <li className="command-palette__empty">No matches. Try dockets, clients, modules, or quick commands.</li> : null}
        </ul>
      </div>
    </>
  );
};
