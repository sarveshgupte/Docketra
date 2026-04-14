import { BULK_UPLOAD_SCHEMA } from './bulkUploadSchema';

export const TYPE_HELPER_TEXT = Object.entries(BULK_UPLOAD_SCHEMA).reduce((acc, [type, schema]) => {
  acc[type] = schema.helperText || [];
  return acc;
}, {});

export const TYPE_FIELD_DESCRIPTIONS = Object.entries(BULK_UPLOAD_SCHEMA).reduce((acc, [type, schema]) => {
  acc[type] = (schema.fields || []).map((field) => {
    const requirement = field.required ? 'required' : 'optional';
    const details = field.description ? `, ${field.description}` : '';
    return `${field.key}: ${requirement}${details}`;
  });
  return acc;
}, {});
