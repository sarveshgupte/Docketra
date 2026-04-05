import React from 'react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDateTime';

const mentionPattern = /(@[a-zA-Z0-9._-]+)/g;

const renderCommentText = (text = '') => {
  if (!mentionPattern.test(text)) {
    return text;
  }

  mentionPattern.lastIndex = 0;
  const parts = text.split(mentionPattern);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return <mark key={`${part}-${index}`} className="docket-comment-item__mention">{part}</mark>;
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
};

export function CommentItem({ comment, className = '', itemRef = null }) {
  const authorName = comment?.createdByName || comment?.createdByXID || comment?.createdBy || 'System';
  const authorInitial = String(authorName || 'S').trim().charAt(0).toUpperCase() || 'S';
  const timestamp = formatDateTime(comment?.createdAt) || 'Unknown time';
  const relativeTimestamp = formatRelativeTime(comment?.createdAt) || timestamp;
  const itemClassName = ['docket-comment-item', className].filter(Boolean).join(' ');

  return (
    <li className={itemClassName} ref={itemRef}>
      <div className="docket-comment-item__avatar" aria-hidden="true">{authorInitial}</div>
      <div className="docket-comment-item__body">
        <div className="docket-comment-item__meta">
          <span className="docket-comment-item__author">{authorName}</span>
          <time className="docket-comment-item__time" title={relativeTimestamp}>{timestamp}</time>
        </div>
        <p className="docket-comment-item__text">{renderCommentText(comment?.text || '')}</p>
      </div>
    </li>
  );
}
