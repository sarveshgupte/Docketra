import { Button } from '../../components/common/Button';
import { formatDateTime } from '../../utils/formatDateTime';
import { DocketCommentsSection } from './DocketCommentsSection';

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
  accessMode,
  permissions,
  caseData,
  commentComposerId,
  newComment,
  onNewCommentChange,
  onAddComment,
  submitting,
}) => {
  const canComment = Boolean(accessMode?.canComment || permissions?.canAddComment?.(caseData));

  return (
    <section
      className="case-card case-detail-section case-detail-section--comments"
      id="panel-activity"
      role="tabpanel"
      aria-labelledby="tab-activity"
    >
      <div className="case-card__heading case-detail-section__heading">
        <div>
          <p className="docket-section-kicker">Audit &amp; Collaboration</p>
          <h2 id="comments-heading">Activity</h2>
          <p className="case-detail-section__subheading">Operational timeline, status changes, and team comments.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="timeline-event-filter" className="sr-only">
            Filter activity events
          </label>
          <select
            id="timeline-event-filter"
            aria-label="Filter activity events"
            value={timelineFilter}
            onChange={(event) => onTimelineFilterChange(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <option value="ALL">All events</option>
            <option value="STATUS_CHANGED">Status changes</option>
            <option value="ASSIGNED">Assignments</option>
            <option value="COMMENT_ADDED">Comments</option>
          </select>
        </div>
      </div>

      <div>
        {timelineLoading ? <p className="case-detail__empty-note">Loading activity…</p> : null}
        {!timelineLoading && !mergedTimelineEvents.length ? (
          <p className="case-detail__empty-note">No activity events recorded yet.</p>
        ) : null}
        {!timelineLoading && mergedTimelineEvents.length > 0 ? (
          <ul className="space-y-2.5">
            {mergedTimelineEvents.map((event, index) => (
              <li
                key={`${event._id || event.id || index}`}
                className="flex items-start gap-2.5 border-l-2 border-slate-200 py-0.5 pl-3"
              >
                <span className="mt-0.5 font-mono text-xs text-slate-500" aria-hidden="true">
                  {event.icon || '•'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-900">
                    {event.description || event.action || event.actionType || 'Updated'}
                  </div>
                  <div className="text-[11px] tabular-nums text-slate-500">
                    {event.actorLabel || 'System'} • {formatDateTime(event.createdAt || event.timestamp)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {(timelinePage > 1 || timelineHasNextPage) ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={timelinePage <= 1} onClick={onPrevTimelinePage}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!timelineHasNextPage} onClick={onNextTimelinePage}>
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <DocketCommentsSection
        embedded
        sectionLoading={sectionLoading}
        commentsListRef={commentsListRef}
        visibleComments={visibleComments}
        comments={comments}
        onLoadOlderComments={onLoadOlderComments}
        canComment={canComment}
        commentComposerId={`${commentComposerId}-activity`}
        newComment={newComment}
        onNewCommentChange={onNewCommentChange}
        onAddComment={onAddComment}
        submitting={submitting}
        placeholder="Enter a comment or review note…"
      />
    </section>
  );
};
