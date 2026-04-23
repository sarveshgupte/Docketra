import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { DocketComments } from '../../components/docket/DocketComments';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailActivityPanel = ({
  timelineFilter,
  onTimelineFilterChange,
  timelineLoading,
  mergedTimelineEvents,
  timelinePage,
  timelineHasNextPage,
  onPrevTimelinePage,
  onNextTimelinePage,
  sectionLoading,
  commentsListRef,
  visibleComments,
  comments,
  onLoadOlderComments,
  initialVirtualWindow,
  accessMode,
  permissions,
  caseData,
  commentComposerId,
  newComment,
  onNewCommentChange,
  onAddComment,
  submitting,
}) => (
  <section className="case-card case-detail-section case-detail-section--comments" id="panel-activity" role="tabpanel" aria-labelledby="tab-activity">
    <div className="case-card__heading case-detail-section__heading">
      <h2 id="comments-heading">Activity</h2>
      <p className="case-detail-section__subheading">Operational timeline, updates, and comments.</p>
    </div>
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <select
          value={timelineFilter}
          onChange={(event) => {
            onTimelineFilterChange(event.target.value);
          }}
        >
          <option value="ALL">All</option>
          <option value="STATUS_CHANGED">Status Changes</option>
          <option value="ASSIGNED">Assignments</option>
          <option value="COMMENT_ADDED">Comments</option>
        </select>
      </div>
      {timelineLoading ? <p className="case-detail__empty-note mt-3">Loading activity…</p> : null}
      {!timelineLoading && !mergedTimelineEvents.length ? <p className="case-detail__empty-note mt-3">No activity events yet.</p> : null}
      {!timelineLoading && mergedTimelineEvents.length ? (
        <ul className="mt-3 space-y-3">
          {mergedTimelineEvents.map((event, index) => (
            <li key={`${event._id || event.id || index}`} className="flex items-start gap-3 border-l-2 border-gray-200 pl-3">
              <span>{event.icon}</span>
              <div>
                <div className="text-sm font-medium">{event.description || event.action || event.actionType || 'Updated'}</div>
                <div className="text-xs text-gray-500">{event.actorLabel} • {formatDateTime(event.createdAt || event.timestamp)}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" disabled={timelinePage <= 1} onClick={onPrevTimelinePage}>
          Previous
        </Button>
        <Button variant="outline" disabled={!timelineHasNextPage} onClick={onNextTimelinePage}>
          Next
        </Button>
      </div>
    </div>
    <div className="case-detail__comments" ref={commentsListRef}>
      {sectionLoading ? (
        <div className="case-detail__section-skeleton" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, idx) => <div key={`comment-skeleton-${idx}`} className="case-detail__skeleton-row" />)}
        </div>
      ) : <DocketComments comments={visibleComments} />}
    </div>
    {comments.length > visibleComments.length ? (
      <div className="case-detail__virtual-actions">
        <Button variant="outline" onClick={onLoadOlderComments}>
          Load older comments ({comments.length - visibleComments.length} remaining)
        </Button>
      </div>
    ) : null}
    {(accessMode.canComment || permissions.canAddComment(caseData)) && (
      <div className="case-detail__add-comment">
        <Textarea
          label="Add Comment"
          id={commentComposerId}
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          placeholder="Enter your comment…"
          rows={3}
          className="case-detail__comment-input"
        />
        <div className="case-detail__composer-actions">
          <Button variant="primary" onClick={onAddComment} disabled={!newComment.trim() || submitting}>
            {submitting ? 'Adding…' : 'Add Comment'}
          </Button>
        </div>
      </div>
    )}
  </section>
);
