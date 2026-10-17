import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatIndianPhoneNumber,
  buildWhatsAppShareUrl,
  buildWhatsAppDocumentRequestMessage,
  getValidityLabel,
  calculateValidityDate,
} from '../src/utils/whatsapp.js';

// 1. Phone number formatting for Indian mobiles
assert.equal(formatIndianPhoneNumber('9820012345'), '919820012345', '10-digit Indian mobile should prepend 91');
assert.equal(formatIndianPhoneNumber('09820012345'), '919820012345', '11-digit mobile starting with 0 should replace 0 with 91');
assert.equal(formatIndianPhoneNumber('919820012345'), '919820012345', '12-digit mobile starting with 91 should remain untouched');
assert.equal(formatIndianPhoneNumber('+91 98200-12345'), '919820012345', 'Formatted string with plus, spaces, and hyphens should be normalized to digits');
assert.equal(formatIndianPhoneNumber(''), '', 'Empty string should return empty string');
assert.equal(formatIndianPhoneNumber(null), '', 'Null should return empty string');

// 2. WhatsApp wa.me URL builder
const urlWithPhone = buildWhatsAppShareUrl({ phone: '9820012345', text: 'Hello World' });
assert.ok(urlWithPhone.startsWith('https://wa.me/919820012345?text='), 'URL with phone should target 919820012345');
assert.ok(urlWithPhone.includes('Hello%20World'), 'URL text should be URI-encoded');

const urlWithoutPhone = buildWhatsAppShareUrl({ phone: '', text: 'Hello Group' });
assert.ok(urlWithoutPhone.startsWith('https://wa.me/?text='), 'URL without phone should target general wa.me/?text= for group/contact picker');

// 3. Message template builder in simple Indian English
const msg = buildWhatsAppDocumentRequestMessage({
  clientName: 'Tata Motors Limited',
  docketTitle: 'Tax Audit Form 3CD',
  docketNumber: 'DOCK-2026-001',
  uploadLink: 'https://docketra.in/upload/sample-token',
  validity: '7d',
  pin: '4821',
  firmName: 'Kapadia & Associates',
});

assert.ok(msg.includes('Namaste Tata Motors Limited,'), 'Message should include respectful greeting with client name');
assert.ok(msg.includes('Tax Audit Form 3CD'), 'Message should include docket title');
assert.ok(msg.includes('https://docketra.in/upload/sample-token'), 'Message should include secure upload link');
assert.ok(msg.includes('7 Days'), 'Message should state 7 Days validity');
assert.ok(msg.includes('Verification PIN: 4821'), 'Message should include verification PIN when provided');
assert.ok(msg.includes('Kapadia & Associates'), 'Message should conclude with firm name');

// 4. Source file contract checks
const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const emailsPanel = read('src/pages/caseDetail/CaseDetailEmailsPanel.jsx');
assert.ok(emailsPanel.includes('Request via WhatsApp'), 'Emails panel should include Request via WhatsApp button');
assert.ok(emailsPanel.includes('buildWhatsAppShareUrl'), 'Emails panel should import WhatsApp URL builder');
assert.ok(emailsPanel.includes('Client Communications & Document Requests'), 'Emails panel header should cover communications & requests');

const sidebar = read('src/components/docket/DocketSidebar.jsx');
assert.ok(sidebar.includes("activeTab === 'request'"), 'DocketSidebar should support request intake tab');
assert.ok(sidebar.includes('Request Files'), 'DocketSidebar tab switcher should include Request Files button');
assert.ok(sidebar.includes('handleShareOnWhatsApp'), 'DocketSidebar should wire handleShareOnWhatsApp');
assert.ok(sidebar.includes('Upload link copied to clipboard.'), 'DocketSidebar should provide upload link copy feedback');

const controller = fs.readFileSync(path.resolve(process.cwd(), '../src/controllers/uploadSession.controller.js'), 'utf8');
assert.ok(controller.includes("channel || '').toUpperCase() === 'WHATSAPP'"), 'uploadSession controller should detect WHATSAPP channel');

console.log('whatsAppIntegration.test.mjs passed successfully!');
