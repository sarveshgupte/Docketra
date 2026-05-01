import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeItemsApi } from '../../api/knowledgeItems.api';
import { ROUTES } from '../../constants/routes';
import { toArray } from '../platform/PlatformShared';

const formatLabel = (value) => String(value || '').replace(/_/g, ' ');

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const getItemKey = (item) => String(item._id || item.id || '');

export const ClientKnowledgeSection = ({
  clientMongoId,
  firmSlug,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!clientMongoId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await knowledgeItemsApi.listKnowledgeItems({
          clientId: clientMongoId,
          status: 'active',
          limit: 50,
        });
        if (!cancelled) {
          const loaded = toArray(res?.data?.data || res?.data?.items || res?.data || []);
          setItems(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || 'Failed to load client knowledge.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [clientMongoId]);

  const goToKnowledgeItem = (item) => {
    const itemId = getItemKey(item);
    if (itemId) {
      navigate(`${ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}?item=${itemId}`);
    } else {
      navigate(ROUTES.KNOWLEDGE_LIBRARY(firmSlug));
    }
  };

  return (
    <section className="case-card" aria-labelledby="client-knowledge-heading">
      <div className="case-card__heading">
        <h2 id="client-knowledge-heading">Client Knowledge</h2>
      </div>
      <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
        Client-specific instructions, SOPs, templates, notes, and process records connected to this client.
      </p>

      {!clientMongoId ? (
        <p className="case-detail__empty-note">
          Client-linked knowledge will appear here once this client has a stable internal client ID.
        </p>
      ) : loading ? (
        <p className="case-detail__empty-note">Loading client knowledge…</p>
      ) : error ? (
        <p className="inline-notice inline-notice--error" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <div>
          <p className="case-detail__empty-note">
            Knowledge records linked to this client will appear here. Add client instructions, SOPs,
            templates, or process notes in Knowledge Library and link them to this client.
          </p>
          {!isAdmin ? (
            <p className="case-detail__empty-note" style={{ marginTop: '0.5rem' }}>
              Ask an admin to link client instructions or SOPs from Knowledge Library.
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
                        Linked to client
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
