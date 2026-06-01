import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { docketEffortApi } from '../../api/docketEffort.api';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { formatDateTime } from '../../utils/formatDateTime';

export const CaseDetailEffortPanel = ({ caseId, caseInternalId, caseInfo, user, onRefreshCase }) => {
  const { showSuccess, showError } = useToast();
  const [efforts, setEfforts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States for logging a new effort
  const [minutes, setMinutes] = useState('');
  const [activityType, setActivityType] = useState('filing');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [logging, setLogging] = useState(false);

  // Manager Budget/Expected minutes adjustment states
  const [expectedMinutes, setExpectedMinutes] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [updatingBudget, setUpdatingBudget] = useState(false);

  const isAdminOrManager = useMemo(() => {
    const role = String(user?.role || '').trim().toUpperCase();
    return ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER'].includes(role) || user?.isPrimaryAdmin;
  }, [user]);

  const loadEfforts = useCallback(async () => {
    if (!caseInternalId || caseInternalId.length !== 24) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await docketEffortApi.getDocketEfforts({ caseInternalId });
      if (response.success && Array.isArray(response.data)) {
        setEfforts(response.data);
      }
    } catch (err) {
      showError('Failed to load effort logs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [caseInternalId, showError]);

  useEffect(() => {
    loadEfforts();
    // Prefill target budget and minutes from caseInfo
    if (caseInfo) {
      setExpectedMinutes(caseInfo.expectedMinutes || '');
      setEstimatedBudget(caseInfo.estimatedBudget || '');
    }
  }, [loadEfforts, caseInfo]);

  const handleLogEffort = async (e) => {
    e.preventDefault();
    const duration = parseInt(minutes, 10);
    if (isNaN(duration) || duration <= 0) {
      showError('Please enter a valid number of minutes (> 0).');
      return;
    }

    setLogging(true);
    try {
      const payload = {
        caseInternalId,
        minutes: duration,
        activityType,
        note: note || undefined,
        date: date ? new Date(date) : new Date(),
      };

      const res = await docketEffortApi.createDocketEffort(payload);
      if (res.success) {
        showSuccess(`Logged ${duration} minutes successfully!`);
        setMinutes('');
        setNote('');
        setDate(new Date().toISOString().slice(0, 10));
        loadEfforts();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to log effort: ' + (err.response?.data?.message || err.message));
    } finally {
      setLogging(false);
    }
  };

  const handleDeleteEffort = async (id, duration) => {
    try {
      const res = await docketEffortApi.deleteDocketEffort(id);
      if (res.success) {
        showSuccess(`Deleted effort entry (${duration} minutes resolved).`);
        loadEfforts();
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to delete effort log: ' + err.message);
    }
  };

  const handleUpdateBudget = async (e) => {
    e.preventDefault();
    setUpdatingBudget(true);
    try {
      const payload = {
        expectedMinutes: expectedMinutes ? parseInt(expectedMinutes, 10) : 0,
        estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : 0,
      };

      const res = await docketEffortApi.updateDocketBudget(caseId, payload);
      if (res.success) {
        showSuccess('Docket budget expectations successfully updated.');
        if (onRefreshCase) onRefreshCase();
      }
    } catch (err) {
      showError('Failed to update budget expectations: ' + err.message);
    } finally {
      setUpdatingBudget(false);
    }
  };

  const actualMinutesLogged = useMemo(() => {
    return efforts.reduce((sum, item) => sum + (item.minutes || 0), 0);
  }, [efforts]);

  const targetMinutes = parseInt(caseInfo?.expectedMinutes || expectedMinutes || 0, 10);
  const targetBudget = parseFloat(caseInfo?.estimatedBudget || estimatedBudget || 0);

  const percentUtilized = targetMinutes > 0 ? Math.round((actualMinutesLogged / targetMinutes) * 100) : 0;
  const isOverBudget = actualMinutesLogged > targetMinutes && targetMinutes > 0;

  const getActivityLabel = (activity) => {
    const map = {
      filing: 'Filing Execution',
      review: 'Quality Review',
      communication: 'Client Communication',
      data_entry: 'Data Entry',
      reconciliation: 'Accounts Reconciliation',
      other: 'Other Activity',
    };
    return map[activity] || activity;
  };

  return (
    <section className="case-card case-detail-section" id="panel-effort" role="tabpanel">
      <div className="case-card__heading case-detail-section__heading">
        <h2>Effort Ingestion & Targets</h2>
        <p className="case-detail-section__subheading">Log manual work time, capture team activity types, and evaluate actual performance against targets.</p>
      </div>

      {/* Target Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Expected Filing Time</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{targetMinutes ? `${targetMinutes} mins` : 'Not set'}</p>
          <p className="text-[10px] text-gray-400 mt-1">Default target from obligation template</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Actual Logged Time</p>
          <p className={`text-3xl font-extrabold mt-1 ${isOverBudget ? 'text-rose-600' : 'text-gray-900'}`}>
            {actualMinutesLogged} mins
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Accumulated from manual log entries</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Estimated Fee Budget</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{targetBudget ? `₹${targetBudget.toLocaleString()}` : '—'}</p>
          <p className="text-[10px] text-gray-400 mt-1">Fixed fee structure for this obligation</p>
        </div>
      </div>

      {/* Progress Bar */}
      {targetMinutes > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }} className="text-xs font-semibold">
            <span className="text-gray-600">Filing Time Budget Utilization</span>
            <span className={isOverBudget ? 'text-rose-600 font-bold' : 'text-indigo-600'}>
              {percentUtilized}% Utilized {isOverBudget && '• Target Exceeded!'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? 'bg-rose-500' : 'bg-indigo-600'}`} 
              style={{ width: `${Math.min(100, percentUtilized)}%` }} 
            />
          </div>
        </div>
      )}

      {/* Main Grid: Form and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Logger Form */}
        <div className="lg:col-span-1 bg-gray-50/50 border border-gray-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">⚡ Log Effort Entry</h3>
          <form onSubmit={handleLogEffort} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="field-label text-xs font-semibold">Logged Duration (minutes) *</label>
              <input 
                type="number" 
                className="neo-input w-full text-sm mt-1" 
                value={minutes} 
                onChange={e => setMinutes(e.target.value)} 
                placeholder="e.g. 15, 45, 125" 
                min="1" 
                required 
              />
            </div>
            <div>
              <label className="field-label text-xs font-semibold">Activity Type *</label>
              <select 
                className="neo-input w-full text-sm mt-1" 
                value={activityType} 
                onChange={e => setActivityType(e.target.value)}
              >
                <option value="filing">Filing Execution</option>
                <option value="review">Quality Review</option>
                <option value="communication">Client Communication</option>
                <option value="data_entry">Data Ingestion / Entry</option>
                <option value="reconciliation">Accounts Reconciliation</option>
                <option value="other">Other Activity</option>
              </select>
            </div>
            <div>
              <label className="field-label text-xs font-semibold">Date *</label>
              <input 
                type="date" 
                className="neo-input w-full text-sm mt-1" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
              />
            </div>
            <div>
              <Textarea 
                label="Filing / review note (optional)" 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Write specific notes on filing blockers resolved or communications completed..." 
                rows={3} 
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={logging}>
              {logging ? 'Saving Entry…' : 'Log Time Entry'}
            </Button>
          </form>

          {/* Manager Adjustment */}
          {isAdminOrManager && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3">⚙ Adjust Expectations (Managers)</h3>
              <form onSubmit={handleUpdateBudget} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="field-label text-[10px] font-semibold text-gray-500">Expected Mins</label>
                    <input 
                      type="number" 
                      className="neo-input w-full text-sm mt-0.5" 
                      value={expectedMinutes} 
                      onChange={e => setExpectedMinutes(e.target.value)} 
                      placeholder="e.g. 60" 
                      min="0" 
                    />
                  </div>
                  <div>
                    <label className="field-label text-[10px] font-semibold text-gray-500">Filing Fee (₹)</label>
                    <input 
                      type="number" 
                      className="neo-input w-full text-sm mt-0.5" 
                      value={estimatedBudget} 
                      onChange={e => setEstimatedBudget(e.target.value)} 
                      placeholder="e.g. 1500" 
                      min="0" 
                      step="any" 
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={updatingBudget}>
                  {updatingBudget ? 'Updating…' : 'Apply Targets'}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Logs Timeline */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-900 mb-3">🕒 Time Entry Audit Logs</h3>
          {loading ? (
            <p className="case-detail__empty-note">Loading effort entries…</p>
          ) : efforts.length === 0 ? (
            <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-500 font-medium">No work time logged on this compliance docket yet.</p>
              <p className="text-xs text-gray-400 mt-1">Capture filing minutes on the left form to calculate profitability analytics.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {efforts.map((item) => (
                <div key={item._id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm hover:border-gray-300 transition-colors">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="text-sm font-bold text-gray-900">{item.minutes} minutes</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                          {getActivityLabel(item.activityType)}
                        </span>
                      </div>
                      {item.note && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">"{item.note}"</p>}
                      <p className="text-[10px] text-gray-400 mt-2">
                        Filing Date: {formatDate(item.date)} · User: {item.userXID || 'System'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                        Logged {formatDateTime(item.createdAt)}
                      </span>
                      {String(item.userXID).toUpperCase() === String(user?.xID).toUpperCase() && (
                        <button
                          onClick={() => handleDeleteEffort(item._id, item.minutes)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors text-xs font-bold"
                          title="Delete entry"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
