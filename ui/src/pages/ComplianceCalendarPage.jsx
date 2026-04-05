import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { usePermissions } from '../hooks/usePermissions';
import { caseApi } from '../api/case.api';
import { clientApi } from '../api/client.api';
import { categoryService } from '../services/categoryService';
import { formatClientDisplay } from '../utils/formatters';
import api from '../services/api';
import './ComplianceCalendarPage.css';

const monthTitle = (date) => date.toLocaleString(undefined, { month: 'long', year: 'numeric' });

const IST_TIMEZONE = 'Asia/Kolkata';

const toISODate = (value, timezone = IST_TIMEZONE) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const getTodayInTimezone = (timezone = IST_TIMEZONE) => {
  const todayIso = toISODate(new Date(), timezone);
  const [year, month] = todayIso.split('-').map((part) => Number(part));
  if (!year || !month) {
    const fallback = new Date();
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }
  return new Date(year, month - 1, 1);
};

const createMonthGrid = (currentMonth) => {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const defaultForm = {
  title: '',
  description: '',
  clientId: '',
  createDocket: false,
  categoryId: '',
  categoryMode: 'existing',
};

export const ComplianceCalendarPage = () => {
  const { isAdmin } = usePermissions();
  const [currentMonth, setCurrentMonth] = useState(() => getTodayInTimezone());
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date(), IST_TIMEZONE));
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(defaultForm);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/compliance-calendar');
      const records = response?.data?.data || [];
      const calendarEvents = records
        .filter((task) => task.dueDate)
        .map((task) => ({
          id: task._id,
          title: task.title,
          description: task.description || '',
          dueDate: toISODate(task.dueDate),
          status: task.status,
          clientId: task.clientId || '',
          clientName: task.clientName || '',
          categoryId: task.categoryId || '',
          categoryName: task.categoryName || '',
          linkedCaseId: task.linkedCaseId || '',
        }));
      setEvents(calendarEvents);
    } catch (apiError) {
      setError('Could not load compliance calendar. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDependencies = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [clientResponse, categoryResponse] = await Promise.all([
        clientApi.getClients(false, true),
        categoryService.getCategories(true),
      ]);
      setClients(clientResponse?.data || []);
      setCategories(categoryResponse?.data || []);
    } catch {
      setError('Could not load clients/categories for docket creation.');
    }
  }, [isAdmin]);

  useEffect(() => {
    loadEvents();
    loadDependencies();
  }, [loadDependencies, loadEvents]);

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, item) => {
      if (!acc[item.dueDate]) acc[item.dueDate] = [];
      acc[item.dueDate].push(item);
      return acc;
    }, {});
  }, [events]);

  const visibleDays = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDate] || [];
  }, [eventsByDate, selectedDate]);

  const resetForm = () => {
    setEditId('');
    setForm(defaultForm);
  };

  const changeMonth = (offset) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const resolveCategoryForDocket = async () => {
    if (form.categoryMode === 'event') {
      const categoryName = form.title.trim();
      if (!categoryName) {
        throw new Error('Title is required to create category from event name.');
      }
      try {
        const created = await categoryService.createCategory(categoryName);
        return created?.data;
      } catch (apiError) {
        const code = apiError?.response?.status;
        if (code !== 409) {
          throw new Error(apiError?.response?.data?.message || 'Failed to create category from event name.');
        }

        const latestCategoriesResponse = await categoryService.getCategories(false);
        const existing = (latestCategoriesResponse?.data || []).find(
          (item) => String(item?.name || '').trim().toLowerCase() === categoryName.toLowerCase(),
        );
        if (!existing) {
          throw new Error('Category already exists but could not be resolved. Please choose it manually.');
        }
        return existing;
      }
    }

    if (!form.categoryId) {
      throw new Error('Category is required when creating a docket.');
    }

    const selected = categories.find((item) => item._id === form.categoryId);
    if (!selected) {
      throw new Error('Selected category is invalid. Please refresh and try again.');
    }

    return selected;
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedDate || !form.title.trim()) return;

    setSaving(true);
    setError('');

    try {
      const selectedClient = clients.find((item) => item.clientId === form.clientId) || null;
      let categoryForEvent = categories.find((item) => item._id === form.categoryId) || null;
      let linkedCaseId = '';

      if (form.createDocket) {
        if (!form.clientId) {
          throw new Error('Client is required when creating a docket.');
        }

        categoryForEvent = await resolveCategoryForDocket();

        const docketPayload = {
          title: form.title.trim(),
          description: form.description.trim() || form.title.trim(),
          clientId: form.clientId,
          categoryId: categoryForEvent._id,
          slaDueDate: `${selectedDate}T18:00`,
        };

        const docketResponse = await caseApi.createCase(docketPayload);
        linkedCaseId = docketResponse?.data?.caseId || '';
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: selectedDate,
        clientId: form.clientId || '',
        clientName: selectedClient ? formatClientDisplay(selectedClient, true) : '',
        categoryId: categoryForEvent?._id || form.categoryId || '',
        categoryName: categoryForEvent?.name || '',
        linkedCaseId,
      };

      if (editId) {
        await api.put(`/compliance-calendar/${editId}`, payload);
      } else {
        await api.post('/compliance-calendar', payload);
      }

      resetForm();
      await Promise.all([loadEvents(), loadDependencies()]);
    } catch (apiError) {
      setError(apiError?.message || apiError?.response?.data?.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (entry) => {
    if (!isAdmin) return;
    setEditId(entry.id);
    setSelectedDate(entry.dueDate);
    setForm({
      title: entry.title,
      description: entry.description || '',
      clientId: entry.clientId || '',
      createDocket: false,
      categoryId: entry.categoryId || '',
      categoryMode: 'existing',
    });
  };

  const handleDeleteEvent = async (eventId) => {
    if (!isAdmin) return;

    setSaving(true);
    try {
      await api.delete(`/compliance-calendar/${eventId}`);
      if (editId === eventId) resetForm();
      await loadEvents();
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Failed to delete event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="compliance-calendar-page">
        <PageHeader
          title="Compliance Calendar"
          description="Shared compliance timeline for firm-wide due dates, reminders, and tasks."
        />

        <div className="compliance-calendar-page__toolbar">
          <div>
            <h2>{monthTitle(currentMonth)}</h2>
            <p>{isAdmin ? 'Admins can add/edit/delete entries. Team members have view-only access.' : 'View-only calendar. Contact your admin to add or edit entries.'}</p>
          </div>
          <div className="compliance-calendar-page__month-controls">
            <Button variant="outline" onClick={() => changeMonth(-1)}>Previous</Button>
            <Button variant="outline" onClick={() => changeMonth(1)}>Next</Button>
          </div>
        </div>

        {error ? <p className="compliance-calendar-page__error">{error}</p> : null}

        <div className="compliance-calendar-page__grid-wrap">
          <div className="compliance-calendar-page__weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="compliance-calendar-page__grid">
            {visibleDays.map((day) => {
              const iso = toISODate(day);
              const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const dayEvents = eventsByDate[iso] || [];
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={[
                    'compliance-calendar-page__day',
                    selectedDate === iso ? 'is-selected' : '',
                    inCurrentMonth ? '' : 'is-muted',
                  ].filter(Boolean).join(' ')}
                >
                  <span>{day.getDate()}</span>
                  {dayEvents.slice(0, 2).map((item) => <small key={item.id}>{item.title}</small>)}
                  {dayEvents.length > 2 ? <small>+{dayEvents.length - 2} more</small> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="compliance-calendar-page__details">
          <h3>{selectedDate}</h3>
          {loading ? <p>Loading events…</p> : null}
          {!loading && selectedDayEvents.length === 0 ? (
            <EmptyState title="No events" description="No compliance reminders for this day." />
          ) : null}
          {selectedDayEvents.map((item) => (
            <article key={item.id} className="compliance-calendar-page__event">
              <div>
                <h4>{item.title}</h4>
                <p>{item.description || 'No details provided.'}</p>
                {item.clientName ? <p><strong>Client:</strong> {item.clientName}</p> : null}
                {item.categoryName ? <p><strong>Category:</strong> {item.categoryName}</p> : null}
                {item.linkedCaseId ? <p><strong>Docket:</strong> {item.linkedCaseId} (routed to Workbasket)</p> : null}
              </div>
              {isAdmin ? (
                <div className="compliance-calendar-page__event-actions">
                  <Button variant="ghost" onClick={() => handleEditEvent(item)} disabled={saving}>Edit</Button>
                  <Button variant="ghost" onClick={() => handleDeleteEvent(item.id)} disabled={saving}>Delete</Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {isAdmin ? (
          <form className="compliance-calendar-page__form" onSubmit={handleSaveEvent}>
            <h3>{editId ? 'Edit reminder/task' : 'Add reminder/task'}</h3>
            <label htmlFor="calendar-title">Title</label>
            <input
              id="calendar-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. GST filing due"
              required
            />
            <label htmlFor="calendar-description">Description</label>
            <textarea
              id="calendar-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional instructions for the team"
              rows={3}
            />
            <label htmlFor="calendar-client">Tag to client (optional)</label>
            <select
              id="calendar-client"
              value={form.clientId}
              onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
            >
              <option value="">No client tag</option>
              {clients.map((client) => (
                <option key={client.clientId} value={client.clientId}>{formatClientDisplay(client)}</option>
              ))}
            </select>

            <label className="compliance-calendar-page__checkbox">
              <input
                type="checkbox"
                checked={form.createDocket}
                onChange={(event) => setForm((prev) => ({ ...prev, createDocket: event.target.checked }))}
                disabled={Boolean(editId)}
              />
              Create docket for this event (auto-routes to Workbasket)
            </label>

            {form.createDocket ? (
              <>
                <label className="compliance-calendar-page__checkbox">
                  <input
                    type="radio"
                    name="calendar-category-mode"
                    value="existing"
                    checked={form.categoryMode === 'existing'}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoryMode: event.target.value }))}
                  />
                  Use an existing category
                </label>
                <label className="compliance-calendar-page__checkbox">
                  <input
                    type="radio"
                    name="calendar-category-mode"
                    value="event"
                    checked={form.categoryMode === 'event'}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoryMode: event.target.value }))}
                  />
                  Create new category from event title
                </label>

                {form.categoryMode === 'existing' ? (
                  <>
                    <label htmlFor="calendar-category">Category</label>
                    <select
                      id="calendar-category"
                      value={form.categoryId}
                      onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>{category.name}</option>
                      ))}
                    </select>
                  </>
                ) : null}
              </>
            ) : null}

            <label htmlFor="calendar-date">Date</label>
            <input
              id="calendar-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              required
            />
            <div className="compliance-calendar-page__form-actions">
              {editId ? <Button variant="outline" type="button" onClick={resetForm}>Cancel edit</Button> : null}
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add to calendar'}</Button>
            </div>
          </form>
        ) : null}
      </div>
    </Layout>
  );
};

export default ComplianceCalendarPage;
