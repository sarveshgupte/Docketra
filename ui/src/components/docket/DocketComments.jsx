import React, { memo } from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

export const DocketComments = memo(({ comments = [] }) => {
  if (!comments.length) {
    return <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">No comments yet.</p>;
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 h-full w-px bg-gray-200" aria-hidden="true" />
      <ul className="space-y-4">
        {comments.map((comment) => {
          const createdBy = comment.createdBy || comment.createdByXID || comment.createdByName || 'System';
          const commentKey = comment.id
            || comment._id
            || `${comment.createdAt || 'na'}-${comment.createdByXID || comment.createdBy || 'system'}-${comment.text || ''}`;
          return (
            <li key={commentKey} className="relative rounded-xl border border-gray-200 bg-white p-4">
              <span className="absolute -left-[29px] top-5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                •
              </span>
              <p className="mb-3 whitespace-pre-wrap text-sm text-gray-900">{comment.text}</p>
              <div className="flex justify-end gap-4 text-xs text-gray-500">
                <span>{formatDateTime(comment.createdAt)}</span>
                <span>ID: {createdBy}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
