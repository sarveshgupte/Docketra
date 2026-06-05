const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Category = require('../models/Category.model');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const log = require('../utils/log');

const DIRECT_UPLOAD_TTL_MS = Number(process.env.CATEGORY_KNOWLEDGE_UPLOAD_TTL_MS || 15 * 60 * 1000);
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.CATEGORY_KNOWLEDGE_MAX_UPLOAD_SIZE_BYTES || 25 * 1024 * 1024);
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
];

const SOP_LINK_TYPES = new Set(['portal', 'reference', 'template', 'internal', 'other']);

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const sanitizeFileName = (value) => String(value || 'knowledge-file.bin').replace(/[^a-zA-Z0-9._-]/g, '_');

const normalizeSopLinks = (links = []) => {
  if (!Array.isArray(links)) return [];
  return links.slice(0, 25)
    .map((link, index) => {
      const title = typeof link?.title === 'string' ? link.title.trim() : '';
      const url = typeof link?.url === 'string' ? link.url.trim() : '';
      if (!title || !url || !isHttpUrl(url)) return null;
      return {
        id: String(link?.id || new mongoose.Types.ObjectId()).trim(),
        title,
        url,
        description: typeof link?.description === 'string' ? link.description.trim() : '',
        type: SOP_LINK_TYPES.has(link?.type) ? link.type : 'reference',
        sortOrder: Number.isFinite(Number(link?.sortOrder)) ? Number(link.sortOrder) : index,
      };
    })
    .filter(Boolean);
};

const normalizeSopFiles = (files = []) => {
  if (!Array.isArray(files)) return [];
  return files.slice(0, 50)
    .map((file, index) => {
      const fileName = typeof file?.fileName === 'string' ? file.fileName.trim() : '';
      const mimeType = typeof file?.mimeType === 'string' ? file.mimeType.trim() : '';
      const storageProvider = typeof file?.storageProvider === 'string' ? file.storageProvider.trim() : '';
      const storageFileId = typeof file?.storageFileId === 'string' ? file.storageFileId.trim() : '';
      const objectKey = typeof file?.objectKey === 'string' ? file.objectKey.trim() : '';
      if (!fileName || !mimeType || !storageProvider) return null;
      return {
        id: String(file?.id || new mongoose.Types.ObjectId()).trim(),
        fileName,
        mimeType,
        size: Number.isFinite(Number(file?.size)) ? Number(file.size) : 0,
        storageProvider,
        storageFileId: storageFileId || null,
        objectKey: objectKey || null,
        webViewLink: typeof file?.webViewLink === 'string' ? file.webViewLink.trim() : null,
        uploadedAt: file?.uploadedAt ? new Date(file.uploadedAt) : new Date(),
        uploadedByXID: file?.uploadedByXID ? String(file.uploadedByXID).trim() : null,
        uploadedByName: file?.uploadedByName ? String(file.uploadedByName).trim() : null,
        description: typeof file?.description === 'string' ? file.description.trim() : '',
        sortOrder: Number.isFinite(Number(file?.sortOrder)) ? Number(file.sortOrder) : index,
      };
    })
    .filter(Boolean);
};

const normalizeSubcategorySop = (input = {}, { actorXID, existingSop = null } = {}) => {
  if (!input || typeof input !== 'object') {
    return {
      title: '',
      body: '',
      format: 'plain_text',
      lastUpdatedAt: null,
      lastUpdatedByXID: null,
      links: [],
      files: [],
    };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body : '';
  const format = input.format === 'markdown' ? 'markdown' : 'plain_text';
  const hasContent = Boolean(title || body);
  const nextFiles = input.files !== undefined
    ? normalizeSopFiles(input.files)
    : normalizeSopFiles(existingSop?.files || []);

  return {
    title,
    body,
    format,
    links: normalizeSopLinks(input.links),
    files: nextFiles,
    lastUpdatedAt: hasContent || nextFiles.length > 0 ? new Date() : null,
    lastUpdatedByXID: (hasContent || nextFiles.length > 0) && actorXID ? String(actorXID).trim() : null,
  };
};

const buildObjectKey = ({ firmId, categoryId, subcategoryId, uploadId, fileName }) => {
  const safeFileName = sanitizeFileName(fileName);
  return `category-knowledge/${String(firmId)}/${String(categoryId)}/${String(subcategoryId)}/${String(uploadId)}/${safeFileName}`;
};

const resolveKnowledgeFolder = async (provider, firmId, categoryId, subcategoryId) => {
  if (!provider || typeof provider.getOrCreateFolder !== 'function') return null;
  try {
    const firmFolder = await provider.getOrCreateFolder(provider.rootFolderId || null, `firm_${firmId}`);
    const knowledgeFolder = await provider.getOrCreateFolder(firmFolder, 'category_knowledge');
    const categoryFolder = await provider.getOrCreateFolder(knowledgeFolder, `category_${categoryId}`);
    const subcategoryFolder = await provider.getOrCreateFolder(categoryFolder, `subcategory_${subcategoryId}`);
    return subcategoryFolder || null;
  } catch (error) {
    log.warn('[CATEGORY_KNOWLEDGE] Folder creation failed', {
      firmId: String(firmId || ''),
      categoryId: String(categoryId || ''),
      subcategoryId: String(subcategoryId || ''),
      message: error.message,
    });
    return null;
  }
};

const assertMimeAndSize = ({ mimeType, size }) => {
  const normalizedMime = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    const error = new Error('Invalid knowledge file MIME type');
    error.status = 400;
    error.code = 'INVALID_FILE_TYPE';
    throw error;
  }

  const parsedSize = Number(size || 0);
  if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize > MAX_UPLOAD_SIZE_BYTES) {
    const error = new Error('Invalid knowledge file size');
    error.status = 400;
    error.code = 'INVALID_FILE_SIZE';
    throw error;
  }
};

const createUploadIntent = async ({
  firmId,
  categoryId,
  subcategoryId,
  fileName,
  mimeType,
  size,
}) => {
  assertMimeAndSize({ mimeType, size });
  const provider = await StorageProviderFactory.getProvider(firmId);
  const folderId = await resolveKnowledgeFolder(provider, firmId, categoryId, subcategoryId);
  const uploadId = randomUUID();
  const objectKey = buildObjectKey({
    firmId,
    categoryId,
    subcategoryId,
    uploadId,
    fileName,
  });

  let directSession;
  try {
    directSession = await provider.createDirectUploadSession({
      fileName,
      mimeType,
      size,
      folderId,
      firmId: String(firmId),
      source: 'category_knowledge',
      contextId: `${categoryId}:${subcategoryId}`,
      uploadId,
      objectKey,
      expiresAt: new Date(Date.now() + DIRECT_UPLOAD_TTL_MS),
    });
  } catch (error) {
    if (!error.status) error.status = 503;
    if (!error.code) error.code = 'CATEGORY_KNOWLEDGE_UPLOAD_UNAVAILABLE';
    throw error;
  }

  return {
    uploadId,
    uploadUrl: directSession.uploadUrl,
    uploadMethod: directSession.method || 'PUT',
    uploadHeaders: directSession.headers || {},
    provider: directSession.provider || provider.providerName || 'unknown',
    providerFileId: directSession.providerFileId || null,
    objectKey: directSession.objectKey || objectKey,
    folderId,
    constraints: {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    },
  };
};

const loadCategoryForKnowledge = async ({ firmId, categoryId }) => {
  const category = await Category.findOne({ _id: categoryId, firmId });
  if (!category) {
    const error = new Error('Category not found');
    error.status = 404;
    throw error;
  }
  return category;
};

const finalizeUpload = async ({
  firmId,
  categoryId,
  subcategoryId,
  fileName,
  mimeType,
  size,
  completion = {},
  checksum,
  actorXID,
  actorName,
}) => {
  const category = await loadCategoryForKnowledge({ firmId, categoryId });
  const subcategory = category.subcategories.find((entry) => String(entry.id) === String(subcategoryId));
  if (!subcategory) {
    const error = new Error('Subcategory not found');
    error.status = 404;
    throw error;
  }

  const provider = await StorageProviderFactory.getProvider(firmId);
  const folderId = await resolveKnowledgeFolder(provider, firmId, categoryId, subcategoryId);
  const verifyFileId = completion.providerFileId || null;
  const verifyObjectKey = completion.objectKey || null;
  let verified;
  try {
    verified = await provider.verifyUploadedObject({
      fileId: verifyFileId,
      objectKey: verifyObjectKey,
      folderId,
      expectedSize: Number(size),
      expectedMimeType: mimeType,
    });
  } catch (error) {
    if (!error.status) error.status = 503;
    if (!error.code) error.code = 'CATEGORY_KNOWLEDGE_UPLOAD_UNAVAILABLE';
    throw error;
  }

  if (!verified?.ok) {
    const error = new Error('Uploaded knowledge file verification failed');
    error.status = 400;
    error.code = 'UPLOAD_VERIFICATION_FAILED';
    throw error;
  }

  const files = Array.isArray(subcategory.sop?.files) ? [...subcategory.sop.files] : [];
  const duplicate = files.find((entry) => (
    (entry.storageFileId && verified.fileId && String(entry.storageFileId) === String(verified.fileId))
    || (entry.objectKey && verifyObjectKey && String(entry.objectKey) === String(verifyObjectKey))
    || (entry.fileName === fileName && Number(entry.size || 0) === Number(size || 0))
  ));
  if (duplicate) {
    return {
      file: duplicate,
      category,
    };
  }

  const nextFile = {
    id: randomUUID(),
    fileName: String(fileName || 'knowledge-file.bin').trim(),
    mimeType: String(mimeType || 'application/octet-stream').trim(),
    size: Number(size || 0),
    storageProvider: verified.provider || provider.providerName || 'unknown',
    storageFileId: verified.fileId || verifyFileId || null,
    objectKey: verifyObjectKey || null,
    webViewLink: verified.webViewLink || null,
    uploadedAt: new Date(),
    uploadedByXID: actorXID ? String(actorXID).trim() : null,
    uploadedByName: actorName ? String(actorName).trim() : null,
    description: '',
    sortOrder: files.length,
  };

  subcategory.sop = normalizeSubcategorySop({
    ...(subcategory.sop?.toObject ? subcategory.sop.toObject() : subcategory.sop || {}),
    files: [...files, nextFile],
  }, {
    actorXID,
    existingSop: subcategory.sop,
  });
  subcategory.markModified('sop');
  await category.save();

  return {
    file: nextFile,
    category,
  };
};

const deleteKnowledgeFile = async ({
  firmId,
  categoryId,
  subcategoryId,
  fileId,
}) => {
  const category = await Category.findOne({ _id: categoryId, firmId });
  if (!category) {
    const error = new Error('Category not found');
    error.status = 404;
    throw error;
  }
  const subcategory = category.subcategories.find((entry) => String(entry.id) === String(subcategoryId));
  if (!subcategory) {
    const error = new Error('Subcategory not found');
    error.status = 404;
    throw error;
  }

  const currentFiles = Array.isArray(subcategory.sop?.files) ? [...subcategory.sop.files] : [];
  const file = currentFiles.find((entry) => String(entry.id) === String(fileId));
  if (!file) {
    const error = new Error('Knowledge file not found');
    error.status = 404;
    throw error;
  }

  const provider = await StorageProviderFactory.getProvider(firmId);
  try {
    if (file.storageProvider === 'google_drive' || file.storageProvider === 'google-drive' || file.storageProvider === 'docketra_managed') {
      const storageId = file.storageFileId || file.objectKey;
      if (storageId && typeof provider.deleteFile === 'function') {
        await provider.deleteFile(storageId);
      }
    } else if (file.objectKey && typeof provider.deleteObject === 'function') {
      await provider.deleteObject(file.objectKey);
    } else if (file.storageFileId && typeof provider.deleteFile === 'function') {
      await provider.deleteFile(file.storageFileId);
    }
  } catch (error) {
    log.warn('[CATEGORY_KNOWLEDGE] File deletion from storage failed', {
      firmId: String(firmId || ''),
      categoryId: String(categoryId || ''),
      subcategoryId: String(subcategoryId || ''),
      fileId: String(fileId || ''),
      message: error.message,
    });
  }

  const nextFiles = currentFiles.filter((entry) => String(entry.id) !== String(fileId));
  subcategory.sop = normalizeSubcategorySop({
    ...(subcategory.sop?.toObject ? subcategory.sop.toObject() : subcategory.sop || {}),
    files: nextFiles.map((entry, index) => ({ ...entry, sortOrder: index })),
  }, {
    actorXID: null,
    existingSop: subcategory.sop,
  });
  subcategory.markModified('sop');
  await category.save();

  return { file, category };
};

const hydrateKnowledgeFiles = async ({ firmId, category }) => {
  if (!category || !Array.isArray(category.subcategories)) return category;
  let provider = null;
  try {
    provider = await StorageProviderFactory.getProvider(firmId);
  } catch (error) {
    log.warn('[CATEGORY_KNOWLEDGE] Storage provider unavailable during hydrate', {
      firmId: String(firmId || ''),
      message: error.message,
    });
    provider = null;
  }

  const categoryObject = typeof category.toObject === 'function' ? category.toObject() : { ...category };
  categoryObject.subcategories = await Promise.all((categoryObject.subcategories || []).map(async (sub) => {
    const sop = sub?.sop ? { ...sub.sop } : null;
    if (!sop || !Array.isArray(sop.files) || sop.files.length === 0 || !provider) {
      return sub;
    }

    const files = await Promise.all(sop.files.map(async (file) => {
      const reference = file.storageFileId || file.objectKey;
      if (!reference || typeof provider.generateDownloadUrl !== 'function') {
        return file;
      }
      try {
        const downloadUrl = await provider.generateDownloadUrl(reference, 10 * 60);
        return {
          ...file,
          downloadUrl,
        };
      } catch (error) {
        log.warn('[CATEGORY_KNOWLEDGE] Failed to hydrate file download URL', {
          firmId: String(firmId || ''),
          categoryId: String(categoryObject?._id || ''),
          subcategoryId: String(sub?.id || ''),
          fileId: String(file?.id || ''),
          message: error.message,
        });
        return file;
      }
    }));

    return {
      ...sub,
      sop: {
        ...sop,
        files,
      },
    };
  }));

  return categoryObject;
};

module.exports = {
  normalizeSubcategorySop,
  normalizeSopLinks,
  normalizeSopFiles,
  createUploadIntent,
  finalizeUpload,
  deleteKnowledgeFile,
  hydrateKnowledgeFiles,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
};
