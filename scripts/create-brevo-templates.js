const https = require('https');

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  console.error('BREVO_API_KEY environment variable is required');
  process.exit(1);
}

const COHORT_CONFIG = {
  maxFirms: 30,
  freeDuration: '1 Full Year',
  pioneerRate: '₹12,990 / year',
  regularRate: '₹17,990 / year',
  savings: '₹5,000',
  ctaUrl: 'https://docketshq.com/signup',
};

const ctaButton = (label, href = COHORT_CONFIG.ctaUrl) => `
  <p style="text-align: center; margin: 32px 0;">
    <a href="${href}" style="background-color: #09090b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">${label}</a>
  </p>
`;

const signoff = (closing = 'Warm regards,', showEmail = false) => `
  <p style="margin-bottom: 4px;">${closing}</p>
  <p style="margin: 0; font-weight: 700; color: #09090b;">Sarvesh Gupte</p>
  <p style="margin: 0; font-size: 13px; color: #52525b;">${showEmail ? 'Founder, DocketsHQ • hello@docketshq.com' : 'Founder, DocketsHQ'}</p>
`;

const emailWrapper = (title, bodyContent) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 28px 36px 20px 36px; border-bottom: 1px solid #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #09090b; letter-spacing: -0.5px;">Dockets<span style="color: #b45309;">HQ</span></span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 12px; background-color: #fef3c7; color: #78350f; padding: 3px 8px; border-radius: 999px; font-weight: 600;">Pioneer ${COHORT_CONFIG.maxFirms} Cohort</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; color: #52525b;">Sovereign Practice Operations</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 36px 36px 36px; font-size: 15px; color: #27272a;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 36px; background-color: #fafafa; border-top: 1px solid #f4f4f5; font-size: 12px; color: #52525b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;"><strong>DocketsHQ</strong> — The Sovereign Company Brain for Indian CAs, CSs, and Legal Practices.</p>
              <p style="margin: 0 0 8px 0;">docketshq.com • Mumbai, India • BYOS Google Drive Architecture</p>
              <p style="margin: 0; font-size: 12px; color: #71717a;">
                You received this as part of the DocketsHQ Pioneer ${COHORT_CONFIG.maxFirms} launch series.
                <a href="{{ unsubscribe }}" style="color: #52525b; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const templates = [
  {
    id: 1,
    name: 'DocketsHQ Pioneer 1: Founder Birthday Launch',
    subject: 'An invitation for your firm (and a personal birthday milestone)',
    body: `
      <p style="margin-top: 0;">Dear Partner,</p>
      <p>Today is my birthday, and instead of a party, I am officially opening the doors to something I've spent the last six months building for Indian professional practices: <strong>DocketsHQ</strong>.</p>
      <p>If your firm is anything like the dozens of CA and CS practices I spoke with in Mumbai and Delhi, you are dealing with two exhausting headaches every single morning:</p>
      <ol style="padding-left: 20px; margin-bottom: 24px;">
        <li style="margin-bottom: 8px;"><strong>Client WhatsApp chaos:</strong> Clients dumping unsorted PDF scans, bank statements, and PAN cards into 30 different chat threads.</li>
        <li style="margin-bottom: 8px;"><strong>Trainee turnover &amp; confidentiality risk:</strong> Article clerks rotating every two years, saving confidential client files to personal unmanaged laptops.</li>
      </ol>
      <div style="background-color: #f8fafc; border-left: 4px solid #b45309; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">The DocketsHQ Architecture:</strong>
        <p style="margin: 0; font-size: 14px; color: #334155;">Clients drop documents through 1-click links directly into <strong>your firm's Google Drive</strong> (Bring-Your-Own-Storage). Trainees follow pre-loaded statutory checklists, and nothing leaves the firm without 4-eye partner approval.</p>
      </div>
      <p>To celebrate the launch, we are welcoming <strong>${COHORT_CONFIG.maxFirms} Founding Firms</strong> into our <strong>Pioneer Cohort</strong>:</p>
      <ul style="padding-left: 20px; margin-bottom: 28px;">
        <li style="margin-bottom: 6px;"><strong>${COHORT_CONFIG.freeDuration} of unrestricted free access</strong> at ₹0 (covers your entire annual tax, ROC &amp; audit cycle).</li>
        <li style="margin-bottom: 6px;">Permanent <strong>${COHORT_CONFIG.pioneerRate} renewal rate locked for life</strong> thereafter (saves ${COHORT_CONFIG.savings}/yr off regular pricing).</li>
        <li style="margin-bottom: 6px;"><strong>Free Concierge Migration:</strong> Send us your messy client spreadsheet; our team will format and import it within 24 hours.</li>
      </ul>
      ${ctaButton(`Claim 1 of the ${COHORT_CONFIG.maxFirms} Pioneer Slots →`)}
      ${signoff('Warm regards,', true)}
    `,
  },
  {
    id: 2,
    name: 'DocketsHQ Pioneer 2: 60-Second Video Demo',
    subject: 'How to turn a 40-message WhatsApp dump into an audit docket in 60s',
    body: `
      <p style="margin-top: 0;">Hi there,</p>
      <p>Most practice management tools fail in India for one simple reason: <strong>clients refuse to log into client portals</strong>. They want to send documents on WhatsApp, and nothing you say will change that.</p>
      <p>Here is how DocketsHQ solves this without changing your clients' habits:</p>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; background-color: #ffffff;">
        <strong style="color: #0f172a; font-size: 16px;">The 60-Second Ingestion Flow:</strong>
        <ol style="padding-left: 20px; margin-top: 12px; margin-bottom: 0;">
          <li style="margin-bottom: 8px;">You send a 1-click secure Client Drop Link on WhatsApp.</li>
          <li style="margin-bottom: 8px;">The client taps the link on their phone and uploads their documents.</li>
          <li style="margin-bottom: 0;">DocketsHQ categorizes and files everything into your firm's own encrypted Google Drive folder.</li>
        </ol>
      </div>
      <p>No password for the client to forget. Zero manual downloading or unzipping for your article clerks.</p>
      <p>The first ${COHORT_CONFIG.maxFirms} founding practices get ${COHORT_CONFIG.freeDuration.toLowerCase()} completely free. Claim your firm's seat below:</p>
      ${ctaButton('Test the 1-Click Client Drop →')}
      ${signoff('Best,')}
    `,
  },
  {
    id: 3,
    name: 'DocketsHQ Pioneer 3: Google Drive Safety & Cryptographic Shield',
    subject: 'Can DocketsHQ see your existing Google Drive folders? (The technical proof)',
    body: `
      <p style="margin-top: 0;">Dear Partner,</p>
      <p>Whenever I speak to a Managing Partner with 10+ years in compliance, their first question is always:</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #71717a; background-color: #f4f4f5; color: #3f3f46; font-style: italic;">
        "Sarvesh, if I connect Google Drive, can your software read my existing confidential client folders?"
      </blockquote>
      <p>The answer is <strong>absolutely not</strong>. Here is the architectural guarantee:</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <p style="margin-top: 0; font-weight: 600; color: #0f172a;">Google's Restricted <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">drive.file</code> Scope:</p>
        <ul style="padding-left: 20px; margin-bottom: 0; font-size: 14px;">
          <li style="margin-bottom: 8px;">DocketsHQ <strong>can only access files it creates itself</strong> inside its isolated subfolder.</li>
          <li style="margin-bottom: 8px;">DocketsHQ has <strong>zero permission to read, list, or download</strong> your existing client files or personal archives.</li>
          <li style="margin-bottom: 0;">If you ever stop using DocketsHQ, you keep 100% of your records in your Drive. Zero hostage data.</li>
        </ul>
      </div>
      <p>You can independently verify this on Google's permission prompt before connecting.</p>
      ${ctaButton('Verify the Sovereign Sandbox →')}
      ${signoff('Warmly,')}
    `,
  },
  {
    id: 4,
    name: 'DocketsHQ Pioneer 4: Form 3CD & 4-Eye Review',
    subject: 'Tax Audit Form 3CD with a day-one intern (Zero partner panic)',
    body: `
      <p style="margin-top: 0;">Hi there,</p>
      <p>During tax audit and ROC season, senior partners routinely find themselves reviewing draft working papers at 11:30 PM on a Saturday.</p>
      <p>Why? Because article clerks rotate every two years, and standardized maker-checker discipline is impossible to enforce over WhatsApp and loose spreadsheets.</p>
      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 18px; margin: 24px 0;">
        <strong style="color: #6b21a8; font-size: 15px;">Inside DocketsHQ:</strong>
        <ul style="padding-left: 20px; margin-top: 10px; margin-bottom: 0; font-size: 14px; color: #3b0764;">
          <li style="margin-bottom: 8px;"><strong>Pre-loaded Statutory Blueprints:</strong> Clause-by-clause checklists for Form 3CD, AOC-4, and MGT-7 so interns never miss mandatory annexures.</li>
          <li style="margin-bottom: 8px;"><strong>The 4-Eye Principle:</strong> No docket is finalized until a designated Partner reviews and signs off on the working papers.</li>
          <li style="margin-bottom: 0;"><strong>SQC-1 Defensibility:</strong> Export an immutable audit log showing timestamps for every maker and checker action for peer reviews.</li>
        </ul>
      </div>
      <p>Your firm gets <strong>${COHORT_CONFIG.freeDuration.toLowerCase()} completely free</strong> as part of the Pioneer ${COHORT_CONFIG.maxFirms} Cohort.</p>
      ${ctaButton('Explore Statutory Blueprints →')}
      ${signoff('Best regards,')}
    `,
  },
  {
    id: 5,
    name: 'DocketsHQ Pioneer 5: Final 48-Hour Scarcity Window',
    subject: 'Closing the Pioneer 30 Cohort this Saturday',
    body: `
      <p style="margin-top: 0;">Hi Partner,</p>
      <p>A quick heads-up: our Pioneer ${COHORT_CONFIG.maxFirms} launch window closes this <strong>Saturday at midnight</strong>.</p>
      <p>After Saturday:</p>
      <ul style="padding-left: 20px; margin-bottom: 24px;">
        <li style="margin-bottom: 6px;">New signups revert to standard Free Sandbox caps and <strong>${COHORT_CONFIG.regularRate}</strong> Starter pricing.</li>
        <li style="margin-bottom: 6px;">1-on-1 concierge migration with our engineering team will be limited.</li>
      </ul>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <strong style="color: #166534; font-size: 15px;">What Pioneer Members Lock in:</strong>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #14532d;">
          <strong>${COHORT_CONFIG.freeDuration} of unrestricted free access</strong> + <strong>${COHORT_CONFIG.pioneerRate} flat locked for life</strong> on renewal (saves ${COHORT_CONFIG.savings} every single year). Zero risk: you pay ₹0 for year one and keep 100% of your Google Drive files.
        </p>
      </div>
      ${ctaButton('Claim Your 1-Year Free Pioneer Seat →')}
      ${signoff('Warmly,', true)}
    `,
  },
];

function upsertTemplate(template) {
  const payload = JSON.stringify({
    templateName: template.name,
    subject: template.subject,
    sender: { name: 'Sarvesh Gupte', email: 'hello@docketshq.com' },
    replyTo: 'hello@docketshq.com',
    htmlContent: emailWrapper(template.subject, template.body),
    isActive: true,
  });

  const method = template.id ? 'PUT' : 'POST';
  const path = template.id ? `/v3/smtp/templates/${template.id}` : '/v3/smtp/templates';

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path,
      method,
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`[${method}] ${template.name} -> STATUS ${res.statusCode}:`, data || 'OK');
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  for (const template of templates) {
    await upsertTemplate(template);
  }
  console.log('All 5 Pioneer templates synced successfully!');
})();
