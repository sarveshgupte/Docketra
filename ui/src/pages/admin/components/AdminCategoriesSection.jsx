import React from 'react';

// Custom inline SVG icons for premium feel
const CategoryIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const SubcategoryIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ToggleIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const UploadIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DEFAULT_CATEGORY_SLA_DAYS = 3;

const getEffectiveSlaDisplay = (category, subcategory) => {
  const subcategorySla = Number(subcategory?.defaultSlaDays || 0);
  if (subcategorySla > 0) {
    return { days: subcategorySla, source: 'subcategory' };
  }

  const categorySla = Number(category?.defaultSlaDays || 0);
  if (categorySla > 0) {
    return { days: categorySla, source: 'category' };
  }

  return { days: DEFAULT_CATEGORY_SLA_DAYS, source: 'default' };
};

const getEffectiveQcDisplay = (category, subcategory) => {
  if (subcategory?.forceQC || category?.forceQC) {
    return { percent: 100, source: 'forced' };
  }

  const subcategoryPercent = Number(subcategory?.qcPercent || 0);
  if (subcategoryPercent > 0) {
    return { percent: subcategoryPercent, source: 'subcategory' };
  }

  const categoryPercent = Number(category?.qcPercent || 0);
  if (categoryPercent > 0) {
    return { percent: categoryPercent, source: 'category' };
  }

  return { percent: 0, source: 'none' };
};

export const AdminCategoriesSection = ({
  categories,
  workbasketNameById,
  onBulkUpload,
  onDownloadTemplate,
  onCreateCategory,
  onAddSubcategory,
  onToggleCategoryStatus,
  onEditCategory,
  onToggleSubcategoryStatus,
  onEditSubcategory,
  StatusBadge,
}) => {
  return (
    <div className="space-y-8 font-sans">
      {/* Premium Glassmorphic Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm hover:shadow-md transition duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-indigo-500">Taxonomy Configuration</span>
          <h1 className="text-2xl font-black text-slate-800 mt-1">Category & Subcategory Management</h1>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed max-w-2xl">
            Maintain category and subcategory taxonomy used by dockets and workbaskets. Align categories, SLA targets, and queue assignments to your workflow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onBulkUpload}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-350 rounded-xl transition duration-200"
          >
            <UploadIcon />
            Bulk Upload
          </button>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-350 rounded-xl transition duration-200"
          >
            <DownloadIcon />
            Download Template
          </button>
          <button
            type="button"
            onClick={onCreateCategory}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-indigo-100 hover:shadow-md transition duration-200"
          >
            <PlusIcon />
            Create Category
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <CategoryIcon />
          </div>
          <h3 className="text-lg font-bold text-slate-700">No categories created yet</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            Use categories to organize your dockets and specify how they are routed to team workbaskets.
          </p>
          <button
            type="button"
            onClick={onCreateCategory}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition duration-200"
          >
            <PlusIcon />
            Create Your First Category
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <div 
              key={category._id} 
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              {/* Category Header Bar */}
              <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <CategoryIcon />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800 leading-none">{category.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                        category.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">ID: {category._id}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:self-center">
                  <button
                    type="button"
                    onClick={() => onAddSubcategory(category)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition duration-200"
                  >
                    <PlusIcon />
                    Add Subcategory
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditCategory(category)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition duration-200"
                  >
                    <EditIcon />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCategoryStatus(category)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition duration-200 ${
                      category.isActive 
                        ? 'text-amber-600 hover:text-white bg-amber-50 hover:bg-amber-600' 
                        : 'text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600'
                    }`}
                  >
                    <ToggleIcon />
                    {category.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* Subcategories Details Section */}
              <div className="p-6">
                {!category.subcategories || category.subcategories.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm font-medium">No subcategories defined for this category.</p>
                    <button
                      type="button"
                      onClick={() => onAddSubcategory(category)}
                      className="mt-3 inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition duration-200"
                    >
                      <PlusIcon />
                      Create Subcategory
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <SubcategoryIcon />
                        Subcategories ({category.subcategories.length})
                      </h4>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/70">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Subcategory</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Linked Workbasket</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Default SLA Target</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">QC Sampling</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                          {category.subcategories.map((sub) => {
                            const linkedWorkbasketName = workbasketNameById.get(String(sub?.workbasketId || ''));
                            const sla = getEffectiveSlaDisplay(category, sub);
                            const qc = getEffectiveQcDisplay(category, sub);
                            return (
                              <tr key={sub.id} className="hover:bg-slate-50/50 transition-all duration-150 group">
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:scale-125 transition duration-200" />
                                    <span className="text-sm font-bold text-slate-700">{sub.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  {linkedWorkbasketName ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200">
                                      🧺 {linkedWorkbasketName}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-600">
                                      ⏱️ {sla.days} working day{Number(sla.days) === 1 ? '' : 's'}
                                    </span>
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                      {sla.source === 'subcategory' ? 'Subcategory' : sla.source === 'category' ? 'Category fallback' : 'System default'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  {qc.percent > 0 ? (
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-slate-600">
                                        🔎 {qc.percent}% to QC
                                      </span>
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        {qc.source === 'forced' ? 'Forced review' : qc.source === 'subcategory' ? 'Subcategory' : 'Category fallback'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs font-medium">No auto QC</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wide border ${
                                    sub.isActive 
                                      ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100' 
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                  <div className="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-all duration-150">
                                    <button
                                      type="button"
                                      onClick={() => onEditSubcategory(category, sub)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition duration-150"
                                      title="Edit Subcategory"
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onToggleSubcategoryStatus(category, sub)}
                                      className={`p-1.5 rounded-lg transition duration-150 ${
                                        sub.isActive 
                                          ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                      }`}
                                      title={sub.isActive ? 'Disable Subcategory' : 'Enable Subcategory'}
                                    >
                                      <ToggleIcon />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
