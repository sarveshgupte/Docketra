const { sendEmail } = require('../email.service');

const sendWelcomeEmail = async ({
  email,
  name,
  xid,
  firmId,
}) => {
  const resolvedEmail = String(email || '').trim().toLowerCase();
  const resolvedName = String(name || '').trim() || 'there';
  const resolvedXid = String(xid || '').trim();
  const resolvedFirmId = String(firmId || '').trim();

  if (!resolvedEmail || !resolvedXid || !resolvedFirmId) {
    throw new Error('Missing required welcome email fields');
  }

  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const workspaceUrl = `${frontendUrl}/firm/${resolvedFirmId}`;
  const subject = 'Welcome to Docketra — Your Workspace is Ready';

  const text = `Hi ${resolvedName},

Your Docketra account has been successfully set up.

Your XID: ${resolvedXid}

Access your workspace:
${workspaceUrl}

You can log in using:
- Google OR
- XID + password

If you did not create this account, please ignore this email.

— Team Docketra`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <p>Hi ${resolvedName},</p>
      <p>Your Docketra account has been successfully set up.</p>
      <p><strong>Your XID:</strong> ${resolvedXid}</p>
      <p><strong>Access your workspace:</strong><br/><a href="${workspaceUrl}">${workspaceUrl}</a></p>
      <p>You can log in using:</p>
      <ul>
        <li>Google OR</li>
        <li>XID + password</li>
      </ul>
      <p>If you did not create this account, please ignore this email.</p>
      <p>— Team Docketra</p>
    </div>
  `;

  return sendEmail({ to: resolvedEmail, subject, text, html });
};

module.exports = {
  sendWelcomeEmail,
};
