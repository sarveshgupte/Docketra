import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { usePermissions } from '../hooks/usePermissions';
import api from '../services/api';
import './ComplianceCalendarPage.css';

const monthTitle = (date) => date.toLocaleString(undefined, { month: 'long', year: 'numeric' });

const toISODate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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

export const ComplianceCalendarPage = () => {
  const { isAdmin } = usePermissions();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ title: '', description: '' });

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
        }));
      setEvents(calendarEvents);
    } catch (apiError) {
      setError('Could not load compliance calendar. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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
    setForm({ title: '', description: '' });
  };

  const changeMonth = (offset) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedDate || !form.title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: selectedDate,
      };

      if (editId) {
        await api.put(`/compliance-calendar/${editId}`, payload);
      } else {
        await api.post('/compliance-calendar', payload);
      }

      resetForm();
      await loadEvents();
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (entry) => {
    if (!isAdmin) return;
    setEditId(entry.id);
    setSelectedDate(entry.dueDate);
    setForm({ title: entry.title, description: entry.description || '' });
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
