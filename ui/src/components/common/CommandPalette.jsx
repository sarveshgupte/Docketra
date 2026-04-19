import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  const inputRef = useRef(null);
  const itemRefs = useRef([]);

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
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen]);

  const executeCommand = (command) => {
    if (!command) return;
    command.action?.();
    onClose?.();
  };

  const handleInputKeyDown = (event) => {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (visibleItems.length ? Math.min(index + 1, visibleItems.length - 1) : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (!visibleItems[activeIndex]) return;
      event.preventDefault();
      executeCommand(visibleItems[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  let itemOffset = 0;

  return (
    <>
      <button type="button" className="command-palette__overlay" onClick={onClose} aria-label="Close command palette" />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command center" onKeyDown={handleInputKeyDown}>
        <div className="command-palette__header">
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
        </div>
        <p className="command-palette__helper">{helperText}</p>
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
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setActiveIndex(visibleIndex)}
                          role="option"
                          aria-selected={active}
                        >
                          <span className="command-palette__item-content">
                            <span className="command-palette__item-label">{command.label}</span>
                            {command.description ? <span className="command-palette__item-description">{command.description}</span> : null}
                          </span>
                          {command.shortcut ? <kbd className="command-palette__item-shortcut">{command.shortcut}</kbd> : null}
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
