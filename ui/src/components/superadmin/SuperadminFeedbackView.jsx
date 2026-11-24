import React, { useState, useEffect, useCallback } from 'react';
import { feedbackService } from '../../services/feedbackService';
import { useToast } from '../../hooks/useToast';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  IN_REVIEW: { label: 'In Review', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Closed', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const TYPE_CONFIG = {
  BUG: { label: 'Bug', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  FEEDBACK: { label: 'Feedback', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ERROR: { label: 'Error', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  OTHER: { label: 'Other', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const SuperadminFeedbackView = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [feedbackList, setFeedbackList] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, bugs: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });

  // Reply state: active replying feedback ID and reply message
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Lightbox screenshot state
  const [previewImage, setPreviewImage] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await feedbackService.getFeedbackStats();
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error('Failed to load feedback stats:', err);
    }
  }, []);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 25,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await feedbackService.getFeedbackList(params);
      if (res.data) {
        setFeedbackList(res.data);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      toast.show('Failed to fetch user feedback list', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, searchQuery, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleSendReply = async (feedbackItem) => {
    const trimmed = replyText.trim();
    if (!trimmed) {
      toast.show('Please enter a response message', 'warning');
      return;
    }

    setSendingReply(true);
    try {
      await feedbackService.replyFeedback(feedbackItem.feedbackId, trimmed);
      toast.show(`Reply sent and emailed to ${feedbackItem.userEmail}`, 'success');
      setReplyingId(null);
      setReplyText('');
      // Refresh list and stats
      fetchFeedback();
      fetchStats();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unable to send reply';
      toast.show(msg, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Action</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{stats.open}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Resolved & Replied</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.resolved}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Bug Reports</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{stats.bugs}</div>
        </div>
      </div>

      {/* 2. Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex-1 w-full sm:max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by ID, user name, xID, email, or message..."
              className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              <option value="BUG">Bug</option>
              <option value="FEEDBACK">Feedback</option>
              <option value="ERROR">Error</option>
              <option value="OTHER">Other</option>
            </select>

            <button
              type="button"
              onClick={() => {
                fetchFeedback();
                fetchStats();
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Refresh list"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Feedback Feed / List */}
      <div className="space-y-4">
        {loading && feedbackList.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
            <svg className="w-6 h-6 animate-spin text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-xs text-slate-500 mt-2 font-medium">Loading user submissions...</p>
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No feedback submissions found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter || typeFilter
                ? 'Try adjusting your search or filters to see more results.'
                : 'No users have submitted bugs or feedback yet.'}
            </p>
          </div>
        ) : (
          feedbackList.map((item) => {
            const statusStyle = STATUS_CONFIG[item.status] || STATUS_CONFIG.OPEN;
            const typeStyle = TYPE_CONFIG[item.type] || TYPE_CONFIG.FEEDBACK;
            const isReplying = replyingId === item.feedbackId;
            const hasReply = Boolean(item.response);
            const createdDate = new Date(item.createdAt);
            const formattedDate = createdDate.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const formattedTime = createdDate.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.feedbackId || item._id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all hover:border-slate-300"
              >
                {/* Header row: ID, Badges, Date & Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {item.feedbackId}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-2xs font-semibold ${typeStyle.color}`}>
                      {typeStyle.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-2xs font-semibold ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-2xs text-slate-400">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formattedDate} at {formattedTime}</span>
                  </div>
                </div>

                {/* User & Workspace Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 py-3 text-xs bg-slate-50/70 rounded-lg px-3 my-3">
                  <div>
                    <span className="text-2xs text-slate-400 uppercase font-semibold block">User Name</span>
                    <span className="font-semibold text-slate-800">{item.userName || 'Anonymous'}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-slate-400 uppercase font-semibold block">User xID</span>
                    <span className="font-mono font-medium text-indigo-700">{item.userXID || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-slate-400 uppercase font-semibold block">Email</span>
                    <a
                      href={`mailto:${item.userEmail}`}
                      className="text-slate-700 hover:text-indigo-600 truncate block font-medium"
                    >
                      {item.userEmail}
                    </a>
                  </div>
                  <div>
                    <span className="text-2xs text-slate-400 uppercase font-semibold block">Firm Workspace</span>
                    <span className="text-slate-800 font-medium truncate block">
                      {item.firmName || item.firmSlug || 'Platform / Direct'}
                    </span>
                  </div>
                </div>

                {/* Page URL if captured */}
                {item.pageUrl && (
                  <div className="mb-3 text-2xs text-slate-500 flex items-center gap-1.5 truncate">
                    <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-slate-400">Captured on page:</span>
                    <span className="font-mono text-slate-600 truncate">{item.pageUrl}</span>
                  </div>
                )}

                {/* User Message */}
                <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                  {item.message}
                </div>

                {/* Screenshot Attachment */}
                {item.screenshot && (
                  <div className="mt-3">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Attached Screenshot
                    </span>
                    <div className="inline-block relative group">
                      <img
                        src={item.screenshot}
                        alt="User Screenshot"
                        className="max-h-40 rounded-lg border border-slate-200 cursor-pointer object-cover shadow-xs group-hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewImage(item.screenshot)}
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewImage(item.screenshot)}
                        className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-white opacity-0 group-hover:opacity-100 rounded-lg transition-opacity font-medium text-2xs gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        <span>Click to Enlarge</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Superadmin Response Section */}
                {hasReply ? (
                  <div className="mt-4 pt-4 border-t border-slate-100 bg-emerald-50/40 rounded-lg p-3.5 border border-emerald-100">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Official Reply Sent</span>
                      </div>
                      <span className="text-2xs text-emerald-700">
                        {item.respondedAt ? new Date(item.respondedAt).toLocaleString('en-IN') : ''} by {item.respondedBy || 'Superadmin'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed pl-5.5">
                      {item.response}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-2xs text-slate-400">
                      Reply will be delivered to user via email and mark this ticket as RESOLVED.
                    </div>
                    {!isReplying && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingId(item.feedbackId);
                          setReplyText('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span>Reply & Email User</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Reply Composer */}
                {isReplying && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Compose Reply to {item.userName} ({item.userEmail})
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingId(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply or resolution note. This will be sent directly to the user's email inbox..."
                      className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyingId(null)}
                        disabled={sendingReply}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendReply(item)}
                        disabled={sendingReply || !replyText.trim()}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs"
                      >
                        {sendingReply ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Sending Email...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            <span>Send Reply via Email</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} submissions)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 5. Screenshot Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-colors z-10"
              title="Close image"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Enlarged Screenshot"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminFeedbackView;
