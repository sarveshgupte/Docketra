import React, { memo } from 'react';
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
      return <mark key={`${part}-${index}`} className="docket-comments__mention">{part}</mark>;
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
};

export const DocketComments = memo(({ comments = [] }) => {
  if (!comments.length) {
    return (
      <p className="docket-comments__empty">
        No comments yet. Add context, next steps, or review notes to keep collaborators aligned.
      </p>
    );
  }

  return (
    <div className="docket-comments">
      <div className="docket-comments__rail" aria-hidden="true" />
      <ul className="docket-comments__list">
        {comments.map((comment) => {
          const createdBy = comment.createdBy || comment.createdByXID || comment.createdByName || 'System';
          const commentKey = comment.id
            || comment._id
            || comment.tempId
            || `${comment.createdAt || 'na'}-${comment.createdByXID || comment.createdBy || 'system'}-${comment.text || ''}`;
          return (
            <li key={commentKey} className="docket-comments__item">
              <span className="docket-comments__dot" aria-hidden="true">•</span>
              <div className="docket-comments__meta">
                <span>{createdBy}</span>
                <span title={formatDateTime(comment.createdAt)}>{formatRelativeTime(comment.createdAt) || formatDateTime(comment.createdAt)}</span>
              </div>
              <p className="docket-comments__text">{renderCommentText(comment.text)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
