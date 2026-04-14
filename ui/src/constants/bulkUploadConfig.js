export const TYPE_HELPER_TEXT = {
  team: [
    'Role must be Admin/User',
    'Workbaskets support multi-value pipe format: WB A|WB B',
    'Clients column optional (pipe-separated clientId or businessEmail)',
  ],
  categories: [
    'Subcategory optional',
    'Workbasket is required for each row',
  ],
  clients: ['Email required'],
};

export const TYPE_FIELD_DESCRIPTIONS = {
  team: [
    'name: full name',
    'email: work email',
    'role: Admin or User',
    'department: optional',
    'workbaskets: required, pipe-separated names/ids',
    'clients: optional, pipe-separated clientId/businessEmail',
  ],
  categories: [
    'category: top-level category',
    'subcategory: optional nested value',
    'workbasket: required active workbasket (name or id)',
  ],
  clients: [
    'businessName: client legal name',
    'businessEmail: required',
    'primaryContactNumber: optional',
    'contactPersonName: optional',
  ],
};
