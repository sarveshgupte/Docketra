import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { DocketComments } from '../../components/docket/DocketComments';

export const DocketCommentsSection = ({
  sectionLoading = false,
  commentsListRef,
  visibleComments = [],
  comments = [],
  onLoadOlderComments,
  canComment = false,
  commentComposerId,
  newComment = '',
  onNewCommentChange,
  onAddComment,
  submitting = false,
  placeholder = 'Type a comment...',
  embedded = false,
}) => {
  const remainingCount = comments.length - visibleComments.length;

  const body = (
    <>
      {canComment ? (
        <div className="case-detail__add-comment flex flex-col gap-3">
          <Textarea
            label="Add Comment"
            id={commentComposerId}
            value={newComment}
            onChange={(e) => onNewCommentChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="case-detail__comment-input"
            enableMentions={true}
          />
          <div className="case-detail__composer-actions flex justify-end">
            <Button variant="primary" onClick={onAddComment} disabled={!newComment.trim() || submitting}>
              {submitting ? 'Adding…' : 'Add Comment'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="case-detail__comments pr-1" ref={commentsListRef}>
        {sectionLoading ? (
          <div className="case-detail__section-skeleton" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`comment-skeleton-${idx}`} className="case-detail__skeleton-row" />
            ))}
          </div>
        ) : (
          <DocketComments comments={visibleComments} />
        )}
      </div>

      {remainingCount > 0 && onLoadOlderComments ? (
        <div className="case-detail__virtual-actions">
          <Button variant="outline" size="sm" onClick={onLoadOlderComments}>
            Load older comments ({remainingCount} remaining)
          </Button>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 mt-5">{body}</div>;
  }

  return (
    <section className="case-card docket-comments-panel flex flex-col gap-4" aria-labelledby="comments-heading-overview">
      <div className="docket-section-heading">
        <div>
          <p className="docket-section-kicker">Collaboration</p>
          <h2 id="comments-heading-overview">Comments</h2>
        </div>
        <span className="docket-section-count tabular-nums">{comments.length} total</span>
      </div>
      {body}
    </section>
  );
};
