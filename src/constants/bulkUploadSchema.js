const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const BULK_UPLOAD_SCHEMA = {
  team: {
    fields: [
      { key: 'name', required: true },
      { key: 'email', required: true, validator: (v) => EMAIL_REGEX.test(String(v || '').trim()) },
      { key: 'role', required: true, validator: (v) => ['admin', 'manager', 'user', 'employee', 'staff'].includes(String(v || '').trim().toLowerCase()) },
      { key: 'department', required: false },
      { key: 'workbaskets', required: true },
      { key: 'clients', required: false },
    ],
  },
  categories: {
    fields: [
      { key: 'category', required: true },
      { key: 'subcategory', required: false },
      { key: 'workbasket', required: true },
    ],
  },
  clients: {
    fields: [
      { key: 'businessName', required: true },
      { key: 'businessEmail', required: false, validator: (v) => EMAIL_REGEX.test(String(v || '').trim()) },
      { key: 'primaryContactNumber', required: false },
      { key: 'businessAddress', required: false },
      { key: 'PAN', required: false },
      { key: 'CIN', required: false },
      { key: 'TAN', required: false },
      { key: 'GST', required: false },
      { key: 'contactPersonName', required: false },
    ],
  },
};

const validateRow = (row = {}, type) => {
  const schema = BULK_UPLOAD_SCHEMA[type];
  if (!schema) return ['Invalid type'];

  const errors = [];

  schema.fields.forEach((field) => {
    const value = String(row[field.key] || '').trim();

    if (field.required && !value) {
      errors.push(`${field.key} is required`);
      return;
    }

    if (value && typeof field.validator === 'function' && !field.validator(value)) {
      errors.push(`${field.key} is invalid`);
    }
  });

  return errors;
};

module.exports = {
  BULK_UPLOAD_SCHEMA,
  validateRow,
};
