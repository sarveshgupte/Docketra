const { sendEmail } = require('../email.service');

const sendWelcomeEmail = async ({
  email,
  name,
  xid,
  firmId,
  role,
}) => {
  const resolvedEmail = String(email || '').trim().toLowerCase();
  const resolvedName = String(name || '').trim() || 'there';
  const resolvedXid = String(xid || '').trim();
  const resolvedFirmId = String(firmId || '').trim();
  const normalizedRole = String(role || '').trim().toUpperCase();
  const isAdminRole = normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_ADMIN';

  if (!resolvedEmail || !resolvedXid || !resolvedFirmId) {
    throw new Error('Missing required welcome email fields');
  }

  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const workspaceUrl = `${frontendUrl}/app/firm/${resolvedFirmId}/dashboard`;
  const settingsUrl = isAdminRole
    ? `${frontendUrl}/app/firm/${resolvedFirmId}/settings/firm`
    : `${frontendUrl}/app/firm/${resolvedFirmId}/profile`;
  const supportEmail = String(process.env.MAIL_FROM || 'support@docketra.com').trim();
  const subject = 'Welcome to Docketra — Your Workspace is Ready';
  const roleLabel = isAdminRole ? 'Admin' : 'User';
  const roleChecklist = isAdminRole
    ? [
      'Open Firm Settings and configure core firm preferences.',
      'Invite team members and align roles.',
      'Create your first docket and assign ownership.',
    ]
    : [
      'Open My Settings and review your profile details.',
      'Visit your Worklist to review assigned dockets.',
      'Update statuses daily to keep timelines on track.',
    ];
  const roleChecklistText = roleChecklist.map((item) => `- ${item}`).join('\n');
  const roleChecklistHtml = roleChecklist.map((item) => `<li>${item}</li>`).join('');

  const text = `Hi ${resolvedName},

Your Docketra account has been successfully set up.

Role: ${roleLabel}
Your XID: ${resolvedXid}

Access your workspace:
${workspaceUrl}

Settings shortcut:
${settingsUrl}

You can log in using:
- Google OR
- XID + password

Start here:
${roleChecklistText}

Need help? Reply to this email or contact ${supportEmail}.

If you did not create this account, please ignore this email.

— Team Docketra`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <p>Hi ${resolvedName},</p>
      <p>Your Docketra account has been successfully set up.</p>
      <p><strong>Role:</strong> ${roleLabel}</p>
      <p><strong>Your XID:</strong> ${resolvedXid}</p>
      <p><strong>Access your workspace:</strong><br/><a href="${workspaceUrl}">${workspaceUrl}</a></p>
      <p><strong>Settings shortcut:</strong><br/><a href="${settingsUrl}">${settingsUrl}</a></p>
      <p>You can log in using:</p>
      <ul>
        <li>Google OR</li>
        <li>XID + password</li>
      </ul>
      <p><strong>Start here:</strong></p>
      <ul>
        ${roleChecklistHtml}
      </ul>
      <p>Need help? Reply to this email or contact ${supportEmail}.</p>
      <p>If you did not create this account, please ignore this email.</p>
      <p>— Team Docketra</p>
    </div>
  `;

  return sendEmail({ to: resolvedEmail, subject, text, html });
};

module.exports = {
  sendWelcomeEmail,
};
