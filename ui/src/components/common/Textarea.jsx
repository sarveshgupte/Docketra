import React, { useId, useState, useEffect, useRef } from 'react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';
import api from '../../services/api';

// Helper to extract initials
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper to generate a unique HSL gradient based on name
const getAvatarGradient = (name) => {
  if (!name) return 'linear-gradient(135deg, var(--dt-accent) 0%, #3b82f6 100%)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 35) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 48%) 0%, hsl(${h2}, 85%, 58%) 100%)`;
};

export const Textarea = ({
  label,
  error,
  success,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  rows = 4,
  enableMentions = false,
  // Destructure event handlers and value so the {...rest} spread below does NOT
  // accidentally override our custom handleInputChange / handleKeyDown.
  onChange: parentOnChange,
  onKeyDown: parentOnKeyDown,
  value,
  id: propId,
  ...rest
}) => {
  const generatedId = useId();
  const textareaId = propId || rest.name || `textarea-${generatedId}`;
  const errorId = `${textareaId}-error`;
  const helpId = `${textareaId}-help`;
  const describedBy = [
    rest['aria-describedby'],
    error ? errorId : null,
    !error && helpText ? helpId : null,
  ].filter(Boolean).join(' ') || undefined;

  // Mentions State
  const [users, setUsers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const suggestionsRef = useRef(null);

  // Load active firm users if mentions are enabled
  useEffect(() => {
    if (!enableMentions) return;
    
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const response = await api.get('/dockets/eligible-users');
        if (response.data?.success && Array.isArray(response.data.data) && isMounted) {
          setUsers(response.data.data.filter(u => u.isActive));
        }
      } catch (err) {
        console.error('Failed to load eligible users for mentions:', err);
      }
    };
    
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [enableMentions]);

  // Handle Input Changes to track mentions
  const handleInputChange = (event) => {
    const currentValue = event.target.value;
    const cursor = event.target.selectionStart;

    // First call the parent's onChange so that state remains synced
    if (parentOnChange) {
      parentOnChange(event);
    }

    if (!enableMentions) return;

    // Check if user is typing a mention
    const textBeforeCursor = currentValue.substring(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    // Active mention: @ found and no space between @ and cursor
    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex + 1).includes(' ')) {
      const query = textBeforeCursor.substring(atIndex + 1).toUpperCase();
      setMentionIndex(atIndex);
      setMentionSearch(query);

      // When users haven't loaded yet, don't show empty popover
      if (!users.length) {
        setShowSuggestions(false);
        return;
      }

      // Empty query (just typed @) → show all users
      const filtered = query === ''
        ? users
        : users.filter(
            (u) =>
              String(u.name || '').toUpperCase().includes(query) ||
              String(u.xID || '').toUpperCase().includes(query)
          );

      setSuggestions(filtered);
      setSelectedIndex(0);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Keyboard navigation inside popover
  const handleKeyDown = (event) => {
    if (!showSuggestions || !suggestions.length) {
      if (parentOnKeyDown) {
        parentOnKeyDown(event);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectUser(suggestions[selectedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setShowSuggestions(false);
    } else {
      if (parentOnKeyDown) {
        parentOnKeyDown(event);
      }
    }
  };

  // Select user and replace `@query` range with tag
  const selectUser = (selectedUser) => {
    const text = value || '';
    const cursor = document.getElementById(textareaId)?.selectionStart || text.length;

    // Format: @Name (xID)
    const mentionText = `@${selectedUser.name} (${selectedUser.xID}) `;
    const newValue = text.substring(0, mentionIndex) + mentionText + text.substring(cursor);

    // Trigger parent onChange with a synthetic event
    if (parentOnChange) {
      parentOnChange({
        target: {
          name: rest.name,
          id: textareaId,
          value: newValue,
        },
      });
    }

    setShowSuggestions(false);

    // Focus and position cursor after selection
    const textarea = document.getElementById(textareaId);
    if (textarea) {
      const newCursorPos = mentionIndex + mentionText.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Returns an array of PRIMARY (non-QC) workbasket name strings for a user
  const getWorkbaskets = (u) => {
    if (Array.isArray(u.teamIds) && u.teamIds.length > 0) {
      const names = u.teamIds
        .filter(t => t.type !== 'QC')
        .map(t => t.name)
        .filter(Boolean);
      if (names.length > 0) return names;
    }
    // Fallback: single teamId — only show if not QC
    if (u.teamId && u.teamId.name && u.teamId.type !== 'QC') return [u.teamId.name];
    return ['Unassigned'];
  };

  return (
    <div className={`w-full relative ${className}`}>
      <FormLabel htmlFor={textareaId} label={label} required={required} />
      <textarea
        id={textareaId}
        className={`${formClasses.textareaBase} ${error ? 'border-[var(--dt-error)] text-[var(--dt-error)] focus:border-[var(--dt-error)] focus:ring-[var(--dt-error)]/20' : ''} ${!error && success ? formClasses.inputSuccess : ''}`}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        style={{ minHeight: '100px', resize: 'vertical' }}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        {...rest}
      />

      {/* Mention suggestions popover */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 left-0 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[var(--dt-border-whisper)] rounded-md shadow-lg py-1 text-xs"
          role="listbox"
          aria-label="Teammate mentions list"
        >
          <div className="px-3 py-1.5 border-b border-[var(--dt-border-whisper)] text-[var(--dt-text-muted)] font-semibold uppercase tracking-wider text-[10px]">
            Teammate Mentions
          </div>
          {suggestions.map((u, index) => {
            const isActive = index === selectedIndex;
            return (
              <div
                key={u.id || u._id || index}
                onClick={() => selectUser(u)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-[var(--dt-accent-subtle)] text-[var(--dt-accent)] font-medium' 
                    : 'text-[var(--dt-text-secondary)] hover:bg-[var(--dt-surface-subtle)]'
                }`}
                role="option"
                aria-selected={isActive}
              >
                {/* Initials Avatar with custom gradient */}
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm border border-white flex-shrink-0"
                  style={{ background: getAvatarGradient(u.name) }}
                >
                  {getInitials(u.name)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate text-[var(--dt-text)]">{u.name}</span>
                    {/* xID badge — accent tint, tight letter-spacing, tabular nums */}
                    <span
                      style={{
                        fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
                        fontSize: '9.5px',
                        letterSpacing: '0.08em',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'color-mix(in srgb, var(--dt-accent) 10%, transparent)',
                        color: 'var(--dt-accent)',
                        border: '1px solid color-mix(in srgb, var(--dt-accent) 25%, transparent)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {u.xID}
                    </span>
                  </div>
                  {/* Workbasket pills — one per WB */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getWorkbaskets(u).map((wbName, wbIdx) => (
                      <span
                        key={wbIdx}
                        className="inline-flex items-center gap-0.5 text-[10px] text-[var(--dt-text-muted)] bg-[var(--dt-surface-subtle)] border border-[var(--dt-border-whisper)] rounded px-1.5 py-0.5 font-medium"
                      >
                        <span style={{ fontSize: '9px' }}>💼</span>
                        {wbName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className={formClasses.errorText} id={errorId}>{error}</p>}
      {!error && success && (
        <p className={formClasses.successText} id={helpId}>
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </p>
      )}
      {!error && helpText && <p className={formClasses.helpText} id={helpId}>{helpText}</p>}
    </div>
  );
};
