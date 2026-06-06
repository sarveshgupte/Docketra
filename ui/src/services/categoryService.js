/**
 * Category Service
 */

import api from './api';

const uploadViaSignedUrl = ({ uploadUrl, uploadMethod = 'PUT', uploadHeaders = {}, file }) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open(uploadMethod, uploadUrl);
  Object.entries(uploadHeaders || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) xhr.setRequestHeader(key, value);
  });
  xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
    ? resolve()
    : reject(Object.assign(new Error(`Upload failed with status ${xhr.status}`), { status: xhr.status })));
  xhr.onerror = () => reject(new Error('Upload failed due to network error'));
  xhr.send(file);
});

export const categoryService = {
  /**
   * Get all categories (with optional activeOnly filter)
   */
  getCategories: async (activeOnly = false) => {
    const response = await api.get('/categories', {
      params: { activeOnly: activeOnly ? 'true' : 'false' }
    });
    return response.data;
  },

  /**
   * Get category by ID
   */
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  getAdminCategories: async (activeOnly = false) => {
    const response = await api.get('/admin/categories', {
      params: { activeOnly: activeOnly ? 'true' : 'false' }
    });
    return response.data;
  },

  /**
   * Create a new category (Admin only)
   */
  createCategory: async (name, requiresRelatedEmployeeUser = false, defaultSlaDays = 0, qcPercent = 0) => {
    const response = await api.post('/admin/categories', { name, requiresRelatedEmployeeUser, defaultSlaDays, qcPercent });
    return response.data;
  },

  /**
   * Update category name (Admin only)
   */
  updateCategory: async (id, name, requiresRelatedEmployeeUser = false, defaultSlaDays = 0, qcPercent = 0) => {
    const response = await api.put(`/admin/categories/${id}`, { name, requiresRelatedEmployeeUser, defaultSlaDays, qcPercent });
    return response.data;
  },

  /**
   * Enable/disable category (Admin only)
   */
  toggleCategoryStatus: async (id, isActive) => {
    const response = await api.patch(`/admin/categories/${id}/status`, { isActive });
    return response.data;
  },

  /**
   * Add subcategory to category (Admin only)
   */
  addSubcategory: async (
    categoryId,
    name,
    workbasketId,
    requiresRelatedEmployeeUser = false,
    defaultSlaDays = 0,
    options = {},
  ) => {
    const response = await api.post(`/admin/categories/${categoryId}/subcategories`, {
      name,
      workbasketId,
      requiresRelatedEmployeeUser,
      defaultSlaDays,
      qcPercent: Number(options?.qcPercent) || 0,
      ...(options?.sop ? { sop: options.sop } : {}),
    });
    return response.data;
  },

  /**
   * Update subcategory name (Admin only)
   */
  updateSubcategory: async (
    categoryId,
    subcategoryId,
    name,
    workbasketId,
    requiresRelatedEmployeeUser = false,
    defaultSlaDays = 0,
    options = {},
  ) => {
    const response = await api.put(`/admin/categories/${categoryId}/subcategories/${subcategoryId}`, {
      name,
      workbasketId,
      requiresRelatedEmployeeUser,
      defaultSlaDays,
      qcPercent: Number(options?.qcPercent) || 0,
      ...(options?.sop ? { sop: options.sop } : {}),
    });
    return response.data;
  },

  uploadSubcategoryKnowledgeFile: async (categoryId, subcategoryId, file) => {
    const intentResponse = await api.post(`/admin/categories/${categoryId}/subcategories/${subcategoryId}/sop/files/upload-intent`, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });
    const intent = intentResponse?.data?.data || intentResponse?.data || {};

    await uploadViaSignedUrl({
      uploadUrl: intent.uploadUrl,
      uploadMethod: intent.uploadMethod,
      uploadHeaders: intent.uploadHeaders,
      file,
    });

    const finalizeResponse = await api.post(`/admin/categories/${categoryId}/subcategories/${subcategoryId}/sop/files/finalize`, {
      uploadId: intent.uploadId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      completion: {
        ...(intent.providerFileId ? { providerFileId: intent.providerFileId } : {}),
        ...(intent.objectKey ? { objectKey: intent.objectKey } : {}),
      },
    });

    return finalizeResponse.data;
  },

  deleteSubcategoryKnowledgeFile: async (categoryId, subcategoryId, fileId) => {
    const response = await api.delete(`/admin/categories/${categoryId}/subcategories/${subcategoryId}/sop/files/${fileId}`);
    return response.data;
  },

  /**
   * Enable/disable subcategory (Admin only)
   */
  toggleSubcategoryStatus: async (categoryId, subcategoryId, isActive) => {
    const response = await api.patch(`/admin/categories/${categoryId}/subcategories/${subcategoryId}/status`, { isActive });
    return response.data;
  },

  /**
   * Delete category (Admin only) - Soft delete
   */
  deleteCategory: async (id) => {
    const response = await api.delete(`/admin/categories/${id}`);
    return response.data;
  },

  /**
   * Delete subcategory (Admin only) - Soft delete
   */
  deleteSubcategory: async (categoryId, subcategoryId) => {
    const response = await api.delete(`/admin/categories/${categoryId}/subcategories/${subcategoryId}`);
    return response.data;
  },
};
