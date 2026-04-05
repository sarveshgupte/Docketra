import React from 'react';
import { CommentItem } from './CommentItem';

function CommentSkeleton() {
  return (
    <li className="docket-comment-list__skeleton-item" aria-hidden="true">
      <span className="docket-comment-list__skeleton-avatar" />
      <div className="docket-comment-list__skeleton-lines">
        <span className="docket-comment-list__skeleton-line docket-comment-list__skeleton-line--primary" />
        <span className="docket-comment-list__skeleton-line docket-comment-list__skeleton-line--secondary" />
      </div>
    </li>
  );
}

export function CommentList({ comments = [], loading = false, error = '', onRetry, hasMore = false, onLoadMore, loadingMore = false }) {
  if (loading) {
    return (
      <ul className="docket-comment-list docket-comment-list--skeleton" aria-label="Loading comments">
        {Array.from({ length: 3 }).map((_, index) => <CommentSkeleton key={index} />)}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="docket-comment-list__error" role="status">
        <span>{error}</span>
        <button type="button" className="docket-comment-list__retry" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (!comments.length) {
    return <p className="docket-comment-list__empty">No comments yet.</p>;
  }

  return (
    <>
      <ul className="docket-comment-list">
        {comments.map((comment) => {
          const commentKey = comment._id || comment.id || comment.tempId || `${comment.createdAt}-${comment.createdBy || 'system'}`;
          return <CommentItem key={commentKey} comment={comment} />;
        })}
      </ul>
      {hasMore ? (
        <div className="docket-comment-list__actions">
          <button
            type="button"
            className="docket-comment-list__more"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </>
  );
}
