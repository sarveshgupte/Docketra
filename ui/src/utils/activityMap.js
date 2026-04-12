const EVENT_LABELS = {
  LIFECYCLE_CHANGED: ({ toLabel }) => `Moved to ${toLabel}`,
  ASSIGNED: ({ target }) => `Assigned to ${target || 'Unassigned'}`,
  COMMENT_ADDED: () => 'Added a comment',
  BLOCKED: () => 'Marked as Blocked',
  COMPLETED: () => 'Marked as Completed',
};

const TITLE_CASE_OVERRIDES = {
  open_active: 'Active',
  in_progress: 'In Progress',
};

const toTitleCase = (value = '') => String(value)
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

export const toLifecycleLabel = (status) => {
  const key = String(status || '').trim().toLowerCase();
  if (!key) return 'Unknown';
  return TITLE_CASE_OVERRIDES[key] || toTitleCase(key);
};

const getRawTimestamp = (event) => event?.created_at || event?.createdAt || event?.timestamp || null;

const getType = (event) => String(event?.type || 'UNKNOWN').trim().toUpperCase();

export const getActivityAction = (event) => {
  const type = getType(event);
  const toLabel = toLifecycleLabel(event?.to || event?.next || event?.lifecycle);
  const target = event?.target || event?.assignee || event?.assignedTo || '';

  const resolver = EVENT_LABELS[type];
  if (resolver) {
    return resolver({ toLabel, target, event });
  }

  return toTitleCase(type);
};

export const normalizeActivityEvent = (event, index = 0) => {
  const timestamp = getRawTimestamp(event);
  const type = getType(event);
  const actor = event?.actor || event?.user || event?.performedBy || 'System';

  return {
    ...event,
    id: event?.id || event?._id || `${type}-${timestamp || 'unknown'}-${index}`,
    type,
    actor,
    createdAt: timestamp,
    action: getActivityAction(event),
  };
};

export const sortActivityLatestFirst = (events = []) => [...events].sort((a, b) => {
  const left = Date.parse(a?.createdAt || a?.created_at || 0) || 0;
  const right = Date.parse(b?.createdAt || b?.created_at || 0) || 0;
  return right - left;
});

export const groupActivityEvents = (events = []) => {
  const groups = [];

  events.forEach((event) => {
    const previous = groups[groups.length - 1];
    const signature = [
      event.type,
      event.actor,
      event.target || '',
      event.to || '',
      event.from || '',
      event.action,
    ].join('|');

    if (previous && previous.signature === signature) {
      previous.count += 1;
      if ((Date.parse(event.createdAt) || 0) > (Date.parse(previous.createdAt) || 0)) {
        previous.createdAt = event.createdAt;
      }
      return;
    }

    groups.push({ ...event, count: 1, signature });
  });

  return groups;
};
