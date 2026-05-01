import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeItemsApi } from '../../api/knowledgeItems.api';
import { ROUTES } from '../../constants/routes';
import { normalizeWorkType } from '../../utils/workTypeOptions';
import { toArray } from '../platform/PlatformShared';

const formatLabel = (value) => String(value || '').replace(/_/g, ' ');

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const getItemKey = (item) => String(item._id || item.id || '');


const buildWorkTypeCandidates = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '—') return [];
  const normalized = normalizeWorkType(raw);
  return normalized && normalized !== raw ? [normalized, raw] : [raw];
};

const SOURCE_LABELS = {
  docket: 'Linked to this docket',
  workType: 'Matched by work type',
  client: 'Linked to client',
};

const mergeItems = (byDocket, byWorkType, byClient) => {
  const seen = new Set();
  const result = [];
  for (const item of byDocket) {
    const key = getItemKey(item);
    if (!seen.has(key)) { seen.add(key); result.push({ ...item, _source: 'docket' }); }
  }
  for (const item of byWorkType) {
    const key = getItemKey(item);
    if (!seen.has(key)) { seen.add(key); result.push({ ...item, _source: 'workType' }); }
  }
  for (const item of byClient) {
    const key = getItemKey(item);
    if (!seen.has(key)) { seen.add(key); result.push({ ...item, _source: 'client' }); }
  }
  return result;
};

export const LinkedKnowledgeSection = ({
  caseId,
  categoryLabel,
  clientMongoId,
  firmSlug,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const requests = [];

        if (caseId) {
          requests.push(
            knowledgeItemsApi
              .listKnowledgeItems({ linkedDocketId: caseId, status: 'active', limit: 50 })
              .then((res) => toArray(res?.data?.data || res?.data?.items || res?.data || []))
              .catch(() => []),
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        const workTypeCandidates = buildWorkTypeCandidates(categoryLabel);
        if (workTypeCandidates.length) {
          requests.push(
            Promise.all(
              workTypeCandidates.map((workType) =>
                knowledgeItemsApi
                  .listKnowledgeItems({ linkedWorkType: workType, status: 'active', limit: 50 })
                  .then((res) => toArray(res?.data?.data || res?.data?.items || res?.data || []))
                  .catch(() => []),
              ),
            ).then((responses) => responses.flat()),
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        if (clientMongoId) {
          requests.push(
            knowledgeItemsApi
              .listKnowledgeItems({ clientId: clientMongoId, status: 'active', limit: 50 })
              .then((res) => toArray(res?.data?.data || res?.data?.items || res?.data || []))
              .catch(() => []),
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        const [byDocket, byWorkType, byClient] = await Promise.all(requests);
        if (!cancelled) {
          setItems(mergeItems(byDocket, byWorkType, byClient));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || 'Failed to load linked knowledge.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [caseId, categoryLabel, clientMongoId]);

  const goToKnowledgeItem = (item) => {
    const itemId = getItemKey(item);
    if (itemId) {
      navigate(`${ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}?item=${itemId}`);
    } else {
      navigate(ROUTES.KNOWLEDGE_LIBRARY(firmSlug));
    }
  };

  return (
    <section className="case-card" aria-labelledby="linked-knowledge-heading">
      <div className="case-card__heading">
        <h2 id="linked-knowledge-heading">Linked Knowledge</h2>
      </div>
      <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
        SOPs, checklists, templates, notes, client instructions, and process records connected to this work.
      </p>

      {loading ? (
        <p className="case-detail__empty-note">Loading linked knowledge…</p>
      ) : error ? (
        <p className="inline-notice inline-notice--error" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <div>
          <p className="case-detail__empty-note">
            Knowledge records linked to this work will appear here. Add SOPs, checklists, templates, or client
            instructions in Knowledge Library and link them by work type, client, or docket.
          </p>
          {!isAdmin ? (
            <p className="case-detail__empty-note" style={{ marginTop: '0.5rem' }}>
              Ask an admin to link SOPs, checklists, or client instructions from Knowledge Library.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => navigate(ROUTES.KNOWLEDGE_LIBRARY(firmSlug))}
              style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
            >
              Go to Knowledge Library
            </button>
          )}
        </div>
      ) : (
        <div className="case-detail-table-wrap">
          <table className="case-detail-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Owner</th>
                <th>Review due</th>
                <th>Summary</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const itemId = getItemKey(item);
                const tags = Array.isArray(item.tags) ? item.tags : [];
                const checklistStepCount = item.type === 'checklist' && Array.isArray(item.checklistSteps)
                  ? item.checklistSteps.length
                  : 0;
                return (
                  <tr key={itemId}>
                    <td>{item.title || '—'}</td>
                    <td>{formatLabel(item.type)}</td>
                    <td>{formatLabel(item.status)}</td>
                    <td>{tags.join(', ') || '—'}</td>
                    <td>{item.ownerXid || '—'}</td>
                    <td>{formatDate(item.reviewDueAt) || '—'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.summary || '—'}
                      {checklistStepCount > 0 ? (
                        <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>
                          • {checklistStepCount} steps
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        {SOURCE_LABELS[item._source] || '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => goToKnowledgeItem(item)}
                        aria-label={`View ${item.title} in Knowledge Library`}
                        style={{ fontSize: '0.8rem' }}
                      >
                        View in Knowledge Library
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
