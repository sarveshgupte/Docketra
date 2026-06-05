import { normalizeWorkType } from '../../utils/workTypeOptions';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { categoryService } from '../../services/categoryService';
import { formatDateTime } from '../../utils/formatDateTime';

const LINK_TYPES = {
  portal: 'Portal',
  reference: 'Reference',
  template: 'Template',
  internal: 'Internal',
  other: 'Other',
};

const sortByOrder = (items = []) => (
  [...items].sort((left, right) => Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0))
);

const normalizeText = (value) => String(value || '').trim();

const findMatchingSubcategory = (category, { subcategoryId, subcategoryLabel }) => {
  const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const normalizedLabel = normalizeText(subcategoryLabel).toLowerCase();

  return subcategories.find((entry) => {
    if (!entry) return false;
    if (subcategoryId && String(entry.id || '') === String(subcategoryId)) return true;
    if (!normalizedLabel) return false;
    return normalizeText(entry.name).toLowerCase() === normalizedLabel;
  }) || null;
};

const getChecklistItems = (subcategory, caseChecklist) => {
  const liveChecklist = Array.isArray(subcategory?.checklistTemplate) ? subcategory.checklistTemplate : [];
  if (liveChecklist.length > 0) return sortByOrder(liveChecklist);
  return Array.isArray(caseChecklist) ? sortByOrder(caseChecklist) : [];
};

const getKnowledgeLinks = (sop) => (
  Array.isArray(sop?.links) ? sortByOrder(sop.links) : []
);

const getKnowledgeFiles = (sop) => (
  Array.isArray(sop?.files) ? sortByOrder(sop.files) : []
);

const hasKnowledgeContent = ({ sop, checklist }) => (
  Boolean(
    normalizeText(sop?.title)
    || normalizeText(sop?.body)
    || getKnowledgeLinks(sop).length
    || getKnowledgeFiles(sop).length
    || checklist.length
  )
);

export const LinkedKnowledgeSection = ({
  categoryId,
  subcategoryId,
  categoryLabel,
  subcategoryLabel,
  caseSop,
  caseChecklist,
  firmSlug,
  canManageSettings,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(categoryId));
  const [error, setError] = useState('');
  const [liveSubcategory, setLiveSubcategory] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadLinkedKnowledge = async () => {
      if (!categoryId) {
        setLiveSubcategory(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await categoryService.getCategoryById(categoryId);
        const category = result?.data || null;
        const matchedSubcategory = findMatchingSubcategory(category, { subcategoryId, subcategoryLabel });

        if (!cancelled) {
          setLiveSubcategory(matchedSubcategory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load category-linked knowledge.');
          setLiveSubcategory(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLinkedKnowledge();
    return () => {
      cancelled = true;
    };
  }, [categoryId, subcategoryId, subcategoryLabel]);

  const resolvedSop = useMemo(
    () => liveSubcategory?.sop || caseSop || null,
    [liveSubcategory?.sop, caseSop],
  );
  const checklistItems = useMemo(
    () => getChecklistItems(liveSubcategory, caseChecklist),
    [liveSubcategory, caseChecklist],
  );
  const knowledgeLinks = useMemo(
    () => getKnowledgeLinks(resolvedSop),
    [resolvedSop],
  );
  const knowledgeFiles = useMemo(
    () => getKnowledgeFiles(resolvedSop),
    [resolvedSop],
  );
  const hasKnowledge = hasKnowledgeContent({ sop: resolvedSop, checklist: checklistItems });
  const isSnapshotFallback = !liveSubcategory && hasKnowledgeContent({ sop: caseSop, checklist: Array.isArray(caseChecklist) ? caseChecklist : [] });

  return (
    <section className="case-card" aria-labelledby="linked-knowledge-heading">
      <div className="case-card__heading">
        <h2 id="linked-knowledge-heading">Linked Knowledge</h2>
      </div>
      <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
        Read-only execution context from category settings for this docket&apos;s category and subcategory.
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500">Category</span>
            <span className="font-semibold text-slate-800">{categoryLabel || '—'}</span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500">Subcategory</span>
            <span className="font-semibold text-slate-800">{subcategoryLabel || '—'}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Update this content from Settings → Category Management. Docket users can view it here but cannot edit it in execution.
        </p>
      </div>

      {loading && !hasKnowledge ? (
        <p className="case-detail__empty-note">Loading linked knowledge…</p>
      ) : null}

      {error ? (
        <p className="inline-notice inline-notice--error" role="alert" style={{ marginBottom: hasKnowledge ? '0.75rem' : 0 }}>
          {hasKnowledge ? 'Showing saved docket snapshot because live category knowledge could not be loaded.' : error}
        </p>
      ) : null}

      {isSnapshotFallback && !error ? (
        <p className="case-detail__empty-note" style={{ marginBottom: '0.75rem' }}>
          Showing the docket snapshot of linked knowledge. Save category settings to update future dockets.
        </p>
      ) : null}

      {!hasKnowledge ? (
        <div>
          <p className="case-detail__empty-note">
            No linked knowledge has been added for this subcategory yet.
          </p>
          {canManageSettings ? (
            <button
              type="button"
              onClick={() => navigate(ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug))}
              style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
            >
              Open Category Settings
            </button>
          ) : (
            <p className="case-detail__empty-note" style={{ marginTop: '0.5rem' }}>
              Ask an admin to add instructions or reference links in category settings.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-900">{resolvedSop?.title || 'Work instructions'}</p>
                {liveSubcategory?.sop?.lastUpdatedAt ? (
                  <p className="text-xs text-slate-500 mt-1">
                    Updated {formatDateTime(liveSubcategory.sop.lastUpdatedAt)}
                    {liveSubcategory?.sop?.lastUpdatedByXID ? ` by ${liveSubcategory.sop.lastUpdatedByXID}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
            {normalizeText(resolvedSop?.body) ? (
              <div
                className="case-detail__description-text whitespace-pre-wrap break-words text-sm text-gray-800"
                style={{ marginTop: '0.75rem' }}
              >
                {resolvedSop.body}
              </div>
            ) : (
              <p className="case-detail__empty-note" style={{ marginTop: '0.75rem' }}>
                No text instructions saved.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-slate-900">Reference Links / Files</p>
              <span className="text-xs text-slate-500">
                {knowledgeLinks.length + knowledgeFiles.length} item{knowledgeLinks.length + knowledgeFiles.length === 1 ? '' : 's'}
              </span>
            </div>
            {knowledgeLinks.length === 0 && knowledgeFiles.length === 0 ? (
              <p className="case-detail__empty-note" style={{ marginTop: '0.75rem' }}>
                No linked files or references saved.
              </p>
            ) : (
              <ul className="space-y-3" style={{ marginTop: '0.75rem' }}>
                {knowledgeLinks.map((link, index) => (
                  <li key={link?.id || `${link?.url || 'knowledge-link'}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline break-all">
                        {link.title || link.url}
                      </a>
                      <span className="text-xs uppercase tracking-wider text-slate-500">
                        {LINK_TYPES[String(link?.type || '').toLowerCase()] || 'Reference'}
                      </span>
                    </div>
                    {normalizeText(link?.description) ? (
                      <p className="text-sm text-slate-600" style={{ marginTop: '0.35rem' }}>
                        {link.description}
                      </p>
                    ) : null}
                  </li>
                ))}
                {knowledgeFiles.map((file, index) => {
                  const href = file?.downloadUrl || file?.webViewLink || '';
                  return (
                    <li key={file?.id || `${file?.fileName || 'knowledge-file'}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline break-all">
                            {file?.fileName || 'Knowledge file'}
                          </a>
                        ) : (
                          <span className="text-sm font-semibold text-slate-800 break-all">{file?.fileName || 'Knowledge file'}</span>
                        )}
                        <span className="text-xs uppercase tracking-wider text-slate-500">
                          File
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        {file?.mimeType ? <span>{file.mimeType}</span> : null}
                        {Number.isFinite(Number(file?.size)) ? <span>{Math.round(Number(file.size) / 1024)} KB</span> : null}
                        {file?.uploadedByXID ? <span>Uploaded by {file.uploadedByXID}</span> : null}
                      </div>
                      {normalizeText(file?.description) ? (
                        <p className="text-sm text-slate-600" style={{ marginTop: '0.35rem' }}>
                          {file.description}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-slate-900">Execution Checklist</p>
              <span className="text-xs text-slate-500">{checklistItems.length} step{checklistItems.length === 1 ? '' : 's'}</span>
            </div>
            {checklistItems.length === 0 ? (
              <p className="case-detail__empty-note" style={{ marginTop: '0.75rem' }}>
                No checklist template saved for this subcategory.
              </p>
            ) : (
              <ol className="space-y-3" style={{ marginTop: '0.75rem' }}>
                {checklistItems.map((item, index) => (
                  <li key={item?.id || `${item?.title || 'checklist-item'}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{item?.title || 'Untitled step'}</span>
                      <span className="text-xs uppercase tracking-wider text-slate-500">
                        {item?.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    {normalizeText(item?.description) ? (
                      <p className="text-sm text-slate-600" style={{ marginTop: '0.5rem' }}>
                        {item.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

// buildWorkTypeCandidates
// toArray(res?.data?.data || res?.data?.items || res?.data || [])

// buildWorkTypeCandidates
// toArray(res?.data?.data || res?.data?.items || res?.data || [])
