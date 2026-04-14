const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export const normalizeBulkHeader = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const BULK_UPLOAD_SCHEMA = {
  team: {
    helperText: [
      'Role must be Admin/User',
      'Workbaskets support multi-value pipe format: WB A|WB B',
      'Clients column optional (pipe-separated clientId or businessEmail)',
    ],
    fields: [
      { key: 'name', required: true, description: 'full name', aliases: ['full_name'] },
      { key: 'email', required: true, description: 'work email', aliases: ['work_email'], validator: (value) => EMAIL_REGEX.test(String(value || '').trim()), validatorMessage: 'must be a valid email' },
      { key: 'role', required: true, description: 'Admin or User', aliases: ['user_role'], validator: (value) => ['admin', 'user'].includes(String(value || '').trim().toLowerCase()), validatorMessage: 'must be admin or user' },
      { key: 'department', required: false, description: 'optional', aliases: ['team_department'] },
      { key: 'workbaskets', required: true, description: 'pipe-separated names/ids', aliases: ['workbasket', 'work_baskets', 'workbasket_names'] },
      { key: 'clients', required: false, description: 'optional, pipe-separated clientId/businessEmail', aliases: ['client_ids', 'clientids', 'client_emails'] },
    ],
  },
  categories: {
    helperText: [
      'Subcategory optional',
      'Workbasket is required for each row',
    ],
    fields: [
      { key: 'category', required: true, description: 'top-level category', aliases: ['name', 'category_name'] },
      { key: 'subcategory', required: false, description: 'optional nested value', aliases: ['sub_category', 'sub category'] },
      { key: 'workbasket', required: true, description: 'required active workbasket (name or id)', aliases: ['workbasket_name', 'work_basket'] },
    ],
  },
  clients: {
    helperText: ['Business email and primary contact number are required'],
    fields: [
      { key: 'businessName', required: true, description: 'client legal name', aliases: ['name', 'client_name'] },
      { key: 'businessEmail', required: true, description: 'required', aliases: ['email', 'client_email'], validator: (value) => EMAIL_REGEX.test(String(value || '').trim()), validatorMessage: 'must be a valid email' },
      { key: 'primaryContactNumber', required: true, description: 'required', aliases: ['phone', 'mobile'] },
      { key: 'businessAddress', required: false, description: 'optional', aliases: ['address', 'client_address'] },
      { key: 'PAN', required: false, description: 'optional', aliases: ['pan_number'] },
      { key: 'CIN', required: false, description: 'optional', aliases: ['cin_number'] },
      { key: 'TAN', required: false, description: 'optional', aliases: ['tan_number'] },
      { key: 'GST', required: false, description: 'optional', aliases: ['gst_number', 'gstin'] },
      { key: 'contactPersonName', required: false, description: 'optional', aliases: ['contact_name'] },
    ],
  },
};

export const getBulkUploadFields = (type) => BULK_UPLOAD_SCHEMA[type]?.fields || [];

export const buildTemplateCsv = (type) => `${getBulkUploadFields(type).map((field) => field.key).join(',')}\n`;

export const mapHeadersToSchema = (type, headers = []) => {
  const fields = getBulkUploadFields(type);
  const normalizedHeaders = headers.map((header) => normalizeBulkHeader(header));
  const usedIndexes = new Set();

  const indexByField = fields.reduce((acc, field) => {
    const candidates = [field.key, ...(field.aliases || [])].map(normalizeBulkHeader);
    const idx = normalizedHeaders.findIndex((header, index) => !usedIndexes.has(index) && candidates.includes(header));
    if (idx >= 0) {
      usedIndexes.add(idx);
      acc[field.key] = idx;
    }
    return acc;
  }, {});

  const missingRequired = fields.filter((field) => field.required && typeof indexByField[field.key] !== 'number').map((field) => field.key);

  return { indexByField, missingRequired };
};

export const validateRow = (row = {}, type) => {
  const fields = getBulkUploadFields(type);
  const errors = [];

  fields.forEach((field) => {
    const value = String(row[field.key] || '').trim();

    if (field.required && !value) {
      errors.push(`${field.key} is required`);
      return;
    }

    if (value && typeof field.validator === 'function' && !field.validator(value)) {
      errors.push(`${field.key} ${field.validatorMessage || 'is invalid'}`);
    }
  });

  return errors;
};
