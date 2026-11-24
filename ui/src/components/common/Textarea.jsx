import React, { forwardRef, useId, useState, useEffect, useRef } from 'react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';
import api from '../../services/api';
import { cn } from '../../lib/utils';

// Helper to extract initials
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper to generate a unique HSL gradient based on name
const getAvatarGradient = (name) => {
  if (!name) return 'linear-gradient(135deg, var(--dt-accent, #2563eb) 0%, #3b82f6 100%)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 35) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 48%) 0%, hsl(${h2}, 85%, 58%) 100%)`;
};

export const Textarea = forwardRef(({
  label,
  error,
  success,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  textareaClassName = '',
  rows = 4,
  enableMentions = false,
  onChange: parentOnChange,
  onKeyDown: parentOnKeyDown,
  value,
  id: propId,
  ...rest
}, ref) => {
  const generatedId = useId();
  const textareaId = propId || rest.name || `textarea-${generatedId}`;
  const suggestionsListId = `${textareaId}-suggestions`;
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
          setUsers(response.data.data.filter((u) => u.isActive));
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

    if (parentOnChange) {
      parentOnChange(event);
    }

    if (!enableMentions) return;

    const textBeforeCursor = currentValue.substring(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex + 1).includes(' ')) {
      const query = textBeforeCursor.substring(atIndex + 1).toUpperCase();
      setMentionIndex(atIndex);

      if (!users.length) {
        setShowSuggestions(false);
        return;
      }

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

  const selectUser = (selectedUser) => {
    const text = value || '';
    const cursor = document.getElementById(textareaId)?.selectionStart || text.length;
    const mentionText = `@${selectedUser.name} (${selectedUser.xID}) `;
    const newValue = text.substring(0, mentionIndex) + mentionText + text.substring(cursor);

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

    const textarea = document.getElementById(textareaId);
    if (textarea) {
      const newCursorPos = mentionIndex + mentionText.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

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

  const getWorkbaskets = (u) => {
    if (Array.isArray(u.teamIds) && u.teamIds.length > 0) {
      const names = u.teamIds
        .filter((t) => t.type !== 'QC')
        .map((t) => t.name)
        .filter(Boolean);
      if (names.length > 0) return names;
    }
    if (u.teamId && u.teamId.name && u.teamId.type !== 'QC') return [u.teamId.name];
    return ['Unassigned'];
  };

  return (
    <div className={cn('w-full relative', className)}>
      <FormLabel htmlFor={textareaId} label={label} required={required} />
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'w-full rounded-[var(--dt-radius-control,2px)] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-900 placeholder:text-slate-400 shadow-none transition-[border-color,box-shadow] duration-150',
          'hover:border-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
          formClasses.textareaBase,
          error && 'border-rose-500 focus-visible:ring-rose-500 focus-visible:border-rose-500',
          !error && success && 'border-emerald-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
          textareaClassName
        )}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        style={{ minHeight: '100px', resize: 'vertical' }}
        required={required}
        role="combobox"
        aria-autocomplete={enableMentions ? 'list' : undefined}
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-controls={showSuggestions && suggestions.length > 0 ? suggestionsListId : undefined}
        aria-activedescendant={showSuggestions && suggestions.length > 0 ? `${suggestionsListId}-option-${selectedIndex}` : undefined}
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
          id={suggestionsListId}
          ref={suggestionsRef}
          className="absolute z-50 left-0 mt-1 w-full max-h-56 overflow-y-auto overscroll-contain bg-white border border-slate-200/90 rounded-md shadow-xl py-1 text-xs"
          role="listbox"
          aria-label="Teammate mentions list"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            Teammate Mentions
          </div>
          {suggestions.map((u, index) => {
            const isActive = index === selectedIndex;
            return (
              <div
                id={`${suggestionsListId}-option-${index}`}
                key={u.id || u._id || index}
                onClick={() => selectUser(u)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                  isActive 
                    ? 'bg-slate-100/90 text-slate-900 font-medium' 
                    : 'text-slate-700 hover:bg-slate-50'
                )}
                role="option"
                aria-selected={isActive}
              >
                {/* Initials Avatar */}
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-xs border border-white shrink-0"
                  style={{ background: getAvatarGradient(u.name) }}
                >
                  {getInitials(u.name)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs truncate text-slate-900">{u.name}</span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0 whitespace-nowrap">
                      {u.xID}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getWorkbaskets(u).map((wbName, wbIdx) => (
                      <span
                        key={wbIdx}
                        className="inline-flex items-center text-[10px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded px-1.5 py-0.2 font-medium"
                      >
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

      {error && <p className={cn(formClasses.errorText, 'text-rose-600 text-xs mt-1')} id={errorId}>{error}</p>}
      {!error && success && (
        <p className={cn(formClasses.successText, 'text-emerald-600 text-xs mt-1 flex items-center gap-1')} id={helpId}>
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </p>
      )}
      {!error && helpText && <p className={cn(formClasses.helpText, 'text-slate-500 text-xs mt-1')} id={helpId}>{helpText}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
