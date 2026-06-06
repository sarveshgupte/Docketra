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
  ...props
}) => {
  const generatedId = useId();
  const textareaId = props.id || props.name || `textarea-${generatedId}`;
  const errorId = `${textareaId}-error`;
  const helpId = `${textareaId}-help`;
  const describedBy = [
    props['aria-describedby'],
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
    const value = event.target.value;
    const cursor = event.target.selectionStart;

    // First call the parent's onChange so that state remains synced
    if (props.onChange) {
      props.onChange(event);
    }

    if (!enableMentions || !users.length) return;

    // Check if user is typing a mention
    const textBeforeCursor = value.substring(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex + 1).includes(' ')) {
      // Mention is active!
      const query = textBeforeCursor.substring(atIndex + 1).toUpperCase();
      setMentionIndex(atIndex);
      setMentionSearch(query);

      // Filter users by name or xID
      const filtered = users.filter(
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
      if (props.onKeyDown) {
        props.onKeyDown(event);
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
      if (props.onKeyDown) {
        props.onKeyDown(event);
      }
    }
  };

  // Select user and replace `@query` range with tag
  const selectUser = (selectedUser) => {
    const text = props.value || '';
    const cursor = document.getElementById(textareaId)?.selectionStart || text.length;

    // Format: @Name (xID)
    const mentionText = `@${selectedUser.name} (${selectedUser.xID}) `;
    const newValue = text.substring(0, mentionIndex) + mentionText + text.substring(cursor);

    // Trigger parent onChange
    if (props.onChange) {
      props.onChange({
        target: {
          name: props.name,
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

  const getWorkbasketName = (u) => {
    if (u.teamId && u.teamId.name) return u.teamId.name;
    if (Array.isArray(u.teamIds) && u.teamIds.length > 0 && u.teamIds[0].name) {
      return u.teamIds.map(t => t.name).join(', ');
    }
    return 'Unassigned';
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
        value={props.value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        {...props}
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
                    <span className="text-[10px] text-[var(--dt-text-muted)] font-mono font-bold bg-gray-50 border border-[var(--dt-border-whisper)] px-1 rounded">
                      {u.xID}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--dt-text-muted)] truncate flex items-center gap-1 mt-0.5">
                    <span>💼</span>
                    <span className="truncate">{getWorkbasketName(u)}</span>
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
