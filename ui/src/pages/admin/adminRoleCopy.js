export const ADMIN_ROLE_HELP = {
  hierarchy: 'Primary Admin > Admin > Manager > Employee',
  superAdminNote: 'SuperAdmin is platform-only and is not part of firm team management.',
};

export const ADMIN_ROLE_DESCRIPTIONS = [
  { role: 'Primary Admin', description: 'Owns firm-level administration, role changes, and high-risk actions.' },
  { role: 'Admin', description: 'Manages users and day-to-day access configuration.' },
  { role: 'Manager', description: 'Leads team operations with limited administrative scope.' },
  { role: 'Employee', description: 'Performs assigned work within granted workbasket and client access.' },
  { role: 'Partner', description: 'Optional collaborator role where enabled by firm policy.' },
];
