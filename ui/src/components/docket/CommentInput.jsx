import React, { useState } from 'react';
import { Textarea } from '../common/Textarea';

export function CommentInput({ onSubmit, disabled = false }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) {
      setError('Comment cannot be empty.');
      return;
    }

    setError('');
    const success = await onSubmit?.(trimmed);
    if (success) {
      setValue('');
    }
  };

  return (
    <form className="docket-comment-input" onSubmit={submit}>
      <label className="docket-comment-input__label" htmlFor="docket-comment-field">Add comment</label>
      <Textarea
        id="docket-comment-field"
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Share updates, next steps, or mention teammates with @username"
        disabled={disabled}
        enableMentions={true}
      />
      <div className="docket-comment-input__actions">
        {error ? <span className="docket-comment-input__error">{error}</span> : <span className="docket-comment-input__hint">Use @username to mention teammates.</span>}
        <button type="submit" className="docket-comment-input__submit" disabled={disabled || !value.trim()}>
          {disabled ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}

