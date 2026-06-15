import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Calendar as BigCalendar, dayjsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import { EmptyState, LoadingState, PageSection, StatGrid, StatusMessageStack } from './platform/PlatformShared';
import { calendarApi } from '../api/calendar.api';
import { formatDateOnly } from '../utils/formatDateTime';
import { hasFirmRoleAtLeast } from '../utils/roleHierarchy';
import { useAuth } from '../hooks/useAuth';
import './ComplianceCalendarPage.css';

const localizer = dayjsLocalizer(dayjs);

const calendarEntryTypeOptions = [
  { value: 'important_date', label: 'Important date' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'working_day', label: 'Working day' },
  { value: 'off_day', label: 'Off day' },
];

const recurrenceFrequencyOptions = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonthsClamped = (date, months) => {
  const source = new Date(date);
  const dayOfMonth = source.getDate();
  source.setDate(1);
  source.setMonth(source.getMonth() + months);
  const lastDay = new Date(source.getFullYear(), source.getMonth() + 1, 0).getDate();
  source.setDate(Math.min(dayOfMonth, lastDay));
  return source;
};

const addYearsClamped = (date, years) => addMonthsClamped(date, years * 12);

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return dayjs(date).format('YYYY-MM-DD');
};

const safeText = (value) => String(value || '').trim();

const normalizeCalendarEntry = (entry) => {
  const recurrencePattern = entry?.recurrencePattern && typeof entry.recurrencePattern === 'object'
    ? entry.recurrencePattern
    : null;

  return {
    id: String(entry?._id || entry?.id || ''),
    title: safeText(entry?.title) || 'Untitled calendar entry',
    description: safeText(entry?.description),
    dueDate: entry?.dueDate ? new Date(entry.dueDate) : null,
    status: entry?.status || 'pending',
    clientName: safeText(entry?.clientName),
    clientId: safeText(entry?.clientId),
    categoryName: safeText(entry?.categoryName),
    linkedCaseId: safeText(entry?.linkedCaseId),
    calendarEntryType: entry?.calendarEntryType || 'important_date',
    reminderDaysBefore: Number.isFinite(Number(entry?.reminderDaysBefore)) ? Number(entry.reminderDaysBefore) : '',
    recurrencePattern: recurrencePattern ? {
      frequency: recurrencePattern.frequency || 'none',
      interval: Number.isFinite(Number(recurrencePattern.interval)) ? Number(recurrencePattern.interval) : 1,
      untilDate: recurrencePattern.untilDate ? new Date(recurrencePattern.untilDate) : null,
    } : null,
  };
};

const getInitialFormState = (selectedDate = new Date()) => ({
  id: '',
  title: '',
  dueDate: toInputDate(selectedDate),
  description: '',
  calendarEntryType: 'important_date',
  reminderDaysBefore: '',
  clientName: '',
  linkedCaseId: '',
  recurrenceFrequency: 'none',
  recurrenceInterval: '1',
  recurrenceUntil: '',
});

const createPayload = (form) => {
  const title = safeText(form.title);
  const dueDate = form.dueDate ? new Date(`${form.dueDate}T00:00:00`) : null;
  const recurrenceFrequency = String(form.recurrenceFrequency || 'none').trim().toLowerCase();
  const recurrencePattern = recurrenceFrequency && recurrenceFrequency !== 'none'
    ? {
      frequency: recurrenceFrequency,
      interval: Math.max(1, Number(form.recurrenceInterval) || 1),
      ...(form.recurrenceUntil ? { untilDate: new Date(`${form.recurrenceUntil}T00:00:00`) } : {}),
    }
    : undefined;

  return {
    title,
    dueDate: dueDate ? dueDate.toISOString() : null,
    description: safeText(form.description),
    calendarEntryType: form.calendarEntryType || 'important_date',
    reminderDaysBefore: form.reminderDaysBefore === '' ? undefined : Number(form.reminderDaysBefore),
    clientName: safeText(form.clientName),
    linkedCaseId: safeText(form.linkedCaseId),
    ...(recurrencePattern ? { recurrencePattern } : {}),
  };
};

const matchesSearch = (entry, needle) => {
  if (!needle) return true;
  const haystack = [
    entry.title,
    entry.description,
    entry.clientName,
    entry.clientId,
    entry.linkedCaseId,
    entry.calendarEntryType,
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
};

const addInterval = (date, pattern) => {
  const frequency = String(pattern?.frequency || 'none').toLowerCase();
  const interval = Math.max(1, Number(pattern?.interval) || 1);
  if (frequency === 'daily') return addDays(date, interval);
  if (frequency === 'weekly') return addDays(date, interval * 7);
  if (frequency === 'monthly') return addMonthsClamped(date, interval);
  if (frequency === 'quarterly') return addMonthsClamped(date, interval * 3);
  if (frequency === 'yearly') return addYearsClamped(date, interval);
  return null;
};

const expandEntryOccurrences = (entries, rangeStart, rangeEnd) => {
  const expanded = [];
  const hardLimit = 1200;

  entries.forEach((entry) => {
    if (!entry.dueDate) return;
    const recurrence = entry.recurrencePattern?.frequency && entry.recurrencePattern.frequency !== 'none'
      ? entry.recurrencePattern
      : null;
    const baseStart = startOfDay(entry.dueDate);
    const limit = recurrence?.untilDate ? endOfDay(recurrence.untilDate) : rangeEnd;

    if (!recurrence) {
      if (baseStart >= rangeStart && baseStart <= rangeEnd) {
        expanded.push({
          id: `${entry.id}-${baseStart.toISOString()}`,
          title: entry.title,
          start: baseStart,
          end: addDays(baseStart, 1),
          allDay: true,
          entry,
        });
      }
      return;
    }

    let occurrence = baseStart;
    let iterations = 0;
    while (occurrence <= rangeEnd && iterations < hardLimit) {
      if (occurrence >= rangeStart && occurrence <= limit) {
        expanded.push({
          id: `${entry.id}-${occurrence.toISOString()}`,
          title: entry.title,
          start: occurrence,
          end: addDays(occurrence, 1),
          allDay: true,
          entry,
        });
      }

      const nextOccurrence = addInterval(occurrence, recurrence);
      if (!nextOccurrence || nextOccurrence.getTime() === occurrence.getTime()) break;
      occurrence = nextOccurrence;
      iterations += 1;
      if (occurrence > limit) break;
    }
  });

  return expanded;
};

const recurrenceSummary = (entry) => {
  const recurrence = entry.recurrencePattern;
  if (!recurrence || !recurrence.frequency || recurrence.frequency === 'none') return 'Does not repeat';
  const frequencyLabel = recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1);
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const every = interval === 1 ? frequencyLabel.toLowerCase() : `${interval} ${frequencyLabel.toLowerCase()}s`;
  const until = recurrence.untilDate ? ` until ${formatDateOnly(recurrence.untilDate)}` : '';
  return `Repeats every ${every}${until}`;
};

const eventTypeLabel = (value) => {
  const match = calendarEntryTypeOptions.find((option) => option.value === value);
  return match?.label || 'Important date';
};

const eventColor = (type) => {
  switch (type) {
    case 'holiday':
      return '#2563eb';
    case 'birthday':
      return '#db2777';
    case 'working_day':
      return '#059669';
    case 'off_day':
      return '#7c3aed';
    default:
      return '#0f766e';
  }
};

export const ComplianceCalendarPage = () => {
  const { user } = useAuth();
  const canEditCalendar = hasFirmRoleAtLeast(user, 'ADMIN');
  const [calendarEntries, setCalendarEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingEntryId, setEditingEntryId] = useState('');
  const [form, setForm] = useState(() => getInitialFormState(new Date()));
  const [message, setMessage] = useState({ tone: '', message: '' });
  const [formMessage, setFormMessage] = useState({ tone: '', message: '' });
  const [error, setError] = useState('');

  const loadEntries = async () => {
    setLoadingEntries(true);
    setError('');
    try {
      const response = await calendarApi.listEntries();
      const records = response?.data?.data || [];
      setCalendarEntries(records.map(normalizeCalendarEntry).filter((entry) => entry.id));
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load calendar entries.');
      setCalendarEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return calendarEntries
      .filter((entry) => matchesSearch(entry, needle))
      .filter((entry) => typeFilter === 'ALL' || entry.calendarEntryType === typeFilter)
      .filter((entry) => statusFilter === 'ALL' || entry.status === statusFilter)
      .sort((a, b) => {
        const left = a.dueDate ? a.dueDate.getTime() : 0;
        const right = b.dueDate ? b.dueDate.getTime() : 0;
        return left - right;
      });
  }, [calendarEntries, search, typeFilter, statusFilter]);

  const monthStart = useMemo(() => {
    const date = new Date(calendarDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }, [calendarDate]);

  const monthEnd = useMemo(() => {
    const date = new Date(calendarDate);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }, [calendarDate]);

  const visibleRangeStart = useMemo(() => addDays(monthStart, -7), [monthStart]);
  const visibleRangeEnd = useMemo(() => addDays(monthEnd, 7), [monthEnd]);

  const monthEvents = useMemo(
    () => expandEntryOccurrences(filteredEntries, startOfDay(visibleRangeStart), endOfDay(visibleRangeEnd)),
    [filteredEntries, visibleRangeStart, visibleRangeEnd],
  );

  const dueSoonCount = useMemo(() => {
    const today = startOfDay(new Date());
    const dueWindow = endOfDay(addDays(today, 30));
    return expandEntryOccurrences(calendarEntries, today, dueWindow).length;
  }, [calendarEntries]);

  const overdueCount = useMemo(() => calendarEntries.filter((entry) => {
    if (!entry.dueDate) return false;
    return startOfDay(entry.dueDate) < startOfDay(new Date()) && String(entry.status || '').toLowerCase() !== 'completed';
  }).length, [calendarEntries]);

  const reminderCount = useMemo(() => calendarEntries.filter((entry) => Number.isFinite(Number(entry.reminderDaysBefore))).length, [calendarEntries]);
  const recurringCount = useMemo(() => calendarEntries.filter((entry) => entry.recurrencePattern?.frequency && entry.recurrencePattern.frequency !== 'none').length, [calendarEntries]);

  const summaryItems = useMemo(() => ([
    { label: 'Entries', value: calendarEntries.length, helpText: 'Shared firm events and reminders.' },
    { label: 'Due soon', value: dueSoonCount, helpText: 'Occurrences in the next 30 days.' },
    { label: 'Overdue', value: overdueCount, helpText: 'Past-due one-off entries.' },
    { label: 'With reminders', value: reminderCount, helpText: 'Entries that trigger reminders.' },
    { label: 'Recurring', value: recurringCount, helpText: 'Entries with repeat schedules.' },
  ]), [calendarEntries.length, dueSoonCount, overdueCount, reminderCount, recurringCount]);

  const resetForm = ({ preserveMessage = false } = {}) => {
    setEditingEntryId('');
    setForm(getInitialFormState(selectedDate));
    if (!preserveMessage) {
      setMessage({ tone: '', message: '' });
    }
    setFormMessage({ tone: '', message: '' });
  };

  const handleEdit = (entry) => {
    if (!canEditCalendar || !entry) return;
    setEditingEntryId(entry.id);
    setSelectedDate(entry.dueDate || new Date());
    setForm({
      id: entry.id,
      title: entry.title,
      dueDate: toInputDate(entry.dueDate || new Date()),
      description: entry.description || '',
      calendarEntryType: entry.calendarEntryType || 'important_date',
      reminderDaysBefore: entry.reminderDaysBefore === '' || entry.reminderDaysBefore === null || entry.reminderDaysBefore === undefined ? '' : String(entry.reminderDaysBefore),
      clientName: entry.clientName || '',
      linkedCaseId: entry.linkedCaseId || '',
      recurrenceFrequency: entry.recurrencePattern?.frequency || 'none',
      recurrenceInterval: String(entry.recurrencePattern?.interval || 1),
      recurrenceUntil: toInputDate(entry.recurrencePattern?.untilDate || ''),
    });
    setFormMessage({ tone: '', message: '' });
  };

  const handleEventSelect = (event) => {
    handleEdit(event.entry);
  };

  const handleSelectSlot = ({ start }) => {
    setSelectedDate(start);
    if (canEditCalendar && !editingEntryId) {
      setForm((current) => ({
        ...current,
        dueDate: toInputDate(start),
      }));
    }
    setFormMessage({ tone: '', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEditCalendar) return;

    const payload = createPayload(form);
    if (!payload.title || !payload.dueDate) {
      setFormMessage({ tone: 'error', message: 'Add a title and date.' });
      return;
    }

    if (
      form.recurrenceFrequency !== 'none'
      && form.recurrenceUntil
      && new Date(`${form.recurrenceUntil}T00:00:00`) < new Date(payload.dueDate)
    ) {
      setFormMessage({ tone: 'error', message: 'Repeat-until date must be after the entry date.' });
      return;
    }

    setSavingEntry(true);
    setMessage({ tone: '', message: '' });
    setFormMessage({ tone: '', message: '' });
    try {
      if (editingEntryId) {
        await calendarApi.updateEntry(editingEntryId, payload);
        setMessage({ tone: 'success', message: 'Calendar entry updated.' });
        setFormMessage({ tone: 'success', message: 'Entry updated.' });
      } else {
        await calendarApi.createEntry(payload);
        setMessage({ tone: 'success', message: 'Calendar entry added.' });
        setFormMessage({ tone: 'success', message: 'Entry added.' });
      }
      await loadEntries();
      resetForm({ preserveMessage: true });
    } catch (saveError) {
      const nextMessage = saveError?.message || 'Unable to save the entry.';
      setMessage({ tone: 'error', message: nextMessage });
      setFormMessage({ tone: 'error', message: nextMessage });
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!canEditCalendar || !entryId) return;
    setDeletingEntryId(entryId);
    setMessage({ tone: '', message: '' });
    try {
      await calendarApi.deleteEntry(entryId);
      setMessage({ tone: 'success', message: 'Calendar entry deleted.' });
      await loadEntries();
      if (editingEntryId === entryId) resetForm();
    } catch (deleteError) {
      setMessage({ tone: 'error', message: deleteError?.message || 'Unable to delete the calendar entry.' });
    } finally {
      setDeletingEntryId('');
    }
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: eventColor(event.entry.calendarEntryType),
      color: '#ffffff',
    },
  });

  const statusMessages = [
    error ? { tone: 'error', message: error } : null,
    message.message ? message : null,
  ].filter(Boolean);

  return (
    <PlatformShell
      title="Calendar"
      subtitle="Shared firm events and reminders."
    >
      <div className="compliance-calendar-page">
        <StatusMessageStack messages={statusMessages} />

        <StatGrid items={summaryItems} columns={5} />

        <div className="compliance-calendar-grid">
          <PageSection
            title="Month view"
            description="View and edit shared calendar entries."
            className="compliance-calendar-panel"
          >
            <div className="compliance-calendar-panel__body">
              <div className="compliance-calendar-toolbar">
                <p className="compliance-calendar-note">
                  {canEditCalendar
                    ? 'Pick a day to add an entry, or open one to edit.'
                    : 'Read-only view.'}
                </p>
                <div className="compliance-calendar-toolbar__summary">
                  <span>{monthEvents.length} visible entries</span>
                  <span>{formatDateOnly(monthStart)} - {formatDateOnly(monthEnd)}</span>
                </div>
              </div>

              <div className="compliance-calendar-month">
                {loadingEntries ? (
                  <LoadingState label="Loading calendar…" compact />
                ) : monthEvents.length === 0 ? (
                  <EmptyState
                    title="No entries for this month"
                    body="Add your first entry below."
                    boxed
                  />
                ) : (
                  <BigCalendar
                    localizer={localizer}
                    events={monthEvents}
                    startAccessor="start"
                    endAccessor="end"
                    titleAccessor="title"
                    defaultView="month"
                    views={['month']}
                    date={calendarDate}
                    onNavigate={(nextDate) => setCalendarDate(nextDate)}
                    onSelectEvent={handleEventSelect}
                    onSelectSlot={handleSelectSlot}
                    selectable={canEditCalendar}
                    popup
                    components={{
                      event: ({ event }) => (
                        <span className="truncate">
                          {event.title}
                        </span>
                      ),
                    }}
                    eventPropGetter={eventStyleGetter}
                  />
                )}
              </div>
            </div>
          </PageSection>

          <PageSection
            title="Add entry"
            description="Add a shared event or reminder."
            className="compliance-calendar-panel"
          >
            {canEditCalendar ? (
              <form onSubmit={handleSubmit} className="compliance-calendar-panel__body">
                {formMessage.message ? (
                  <StatusMessageStack messages={[formMessage]} />
                ) : null}
                <div className="compliance-calendar-form-grid">
                  <Input
                    label="Title"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                    required
                  />
                </div>

                <div className="compliance-calendar-form-grid">
                  <Select
                    label="Type"
                    value={form.calendarEntryType}
                    onChange={(event) => setForm((current) => ({ ...current, calendarEntryType: event.target.value }))}
                    options={calendarEntryTypeOptions}
                  />
                  <Input
                    label="Reminder days"
                    type="number"
                    min="0"
                    max="30"
                    value={form.reminderDaysBefore}
                    onChange={(event) => setForm((current) => ({ ...current, reminderDaysBefore: event.target.value }))}
                    helpText="Blank means no reminder."
                  />
                </div>

                <div className="compliance-calendar-form-grid">
                  <Input
                    label="Client name"
                    value={form.clientName}
                    onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                  />
                  <Input
                    label="Linked docket ID"
                    value={form.linkedCaseId}
                    onChange={(event) => setForm((current) => ({ ...current, linkedCaseId: event.target.value }))}
                  />
                </div>

                <Textarea
                  label="Notes"
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  helpText="Optional."
                />

                <div className="compliance-calendar-form-grid compliance-calendar-form-grid--three">
                  <Select
                    label="Repeat"
                    value={form.recurrenceFrequency}
                    onChange={(event) => setForm((current) => ({ ...current, recurrenceFrequency: event.target.value }))}
                    options={recurrenceFrequencyOptions}
                  />
                  <Input
                    label="Repeat every"
                    type="number"
                    min="1"
                    max="52"
                    value={form.recurrenceInterval}
                    onChange={(event) => setForm((current) => ({ ...current, recurrenceInterval: event.target.value }))}
                    disabled={form.recurrenceFrequency === 'none'}
                    helpText="For recurring entries."
                  />
                  <Input
                    label="Repeat until"
                    type="date"
                    value={form.recurrenceUntil}
                    onChange={(event) => setForm((current) => ({ ...current, recurrenceUntil: event.target.value }))}
                    disabled={form.recurrenceFrequency === 'none'}
                    helpText="Optional end date."
                  />
                </div>

                <div className="compliance-calendar-form-actions">
                  {editingEntryId ? (
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  ) : null}
                  <Button type="submit" loading={savingEntry} variant="primary">
                    {editingEntryId ? 'Edit' : 'Add entry'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="compliance-calendar-readonly">
                This calendar is read-only for your role. Admins and primary admins manage entries and repeat schedules.
              </div>
            )}
          </PageSection>
        </div>

        <PageSection
          title="Entries"
          description="Search, filter, and review shared events below the calendar."
        >
          <div className="compliance-calendar-panel__body">
            <div className="compliance-calendar-filter-grid">
              <Input
                label="Search"
                placeholder="Search title, note, client, or docket"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                label="Type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                options={[{ value: 'ALL', label: 'All types' }, ...calendarEntryTypeOptions]}
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={[
                  { value: 'ALL', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'review', label: 'Review' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>

            {filteredEntries.length === 0 ? (
              <EmptyState
                title="No calendar entries found"
                body="Try a wider filter or add the first event."
                boxed
              />
            ) : (
              <Card className="compliance-calendar-table-wrap">
                <table className="compliance-calendar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Reminder</th>
                      <th>Repeat</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.dueDate ? formatDateOnly(entry.dueDate) : '—'}</td>
                        <td>
                          <div>{entry.title}</div>
                          <div className="compliance-calendar-table__muted">
                            {entry.clientName || entry.linkedCaseId ? [entry.clientName, entry.linkedCaseId].filter(Boolean).join(' • ') : 'No linked client or docket'}
                          </div>
                        </td>
                        <td>{eventTypeLabel(entry.calendarEntryType)}</td>
                        <td>{Number.isFinite(Number(entry.reminderDaysBefore)) ? `${entry.reminderDaysBefore} day(s)` : '—'}</td>
                        <td>{recurrenceSummary(entry)}</td>
                        <td className="compliance-calendar-table__muted">{entry.description || '—'}</td>
                        <td>
                          {canEditCalendar ? (
                            <div className="compliance-calendar-table__actions">
                              <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(entry)}>Edit</Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => handleDelete(entry.id)}
                                loading={deletingEntryId === entry.id}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : (
                            <span className="compliance-calendar-table__muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </PageSection>
      </div>
    </PlatformShell>
  );
};

export default ComplianceCalendarPage;
