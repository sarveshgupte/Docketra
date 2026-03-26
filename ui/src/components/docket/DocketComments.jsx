import React, { memo } from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

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
              <p className="docket-comments__text">{comment.text}</p>
              <div className="docket-comments__meta">
                <span>{formatDateTime(comment.createdAt)}</span>
                <span>By: {createdBy}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
