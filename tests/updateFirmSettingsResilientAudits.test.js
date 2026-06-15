#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const createRes = () => ({
  statusCode: 200,
  payload: null,
  headersSent: false,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    this.headersSent = true;
    return this;
  },
});

const mockFirm = {
  _id: '507f1f77bcf86cd799439011',
  firmId: 'FIRM001',
  settings: {
    firm: {
      slaDefaultDays: 3,
      slaWorkingDays: [1, 2, 3, 4, 5],
      slaHolidayDates: [],
      slaWorkingDateOverrides: [],
      calendarReminderLeadDays: 3,
      escalationInactivityThresholdHours: 24,
      workloadThreshold: 15,
      enablePerformanceView: true,
      enableEscalationView: true,
      enableBulkActions: true,
      brandLogoUrl: '',
      strictFirmOwnedStorage: false,
    },
    work: {
      assignmentStrategy: 'manual',
      statusWorkflowMode: 'flexible',
      autoAssignmentEnabled: false,
      highPrioritySlaDays: 1,
      dueSoonWarningDays: 2,
    },
  },
  async save() {
    return this;
  },
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      findById: async () => mockFirm,
    };
  }

  if (request.startsWith('../models/')) return {};

  if (request === '../services/auditLog.service') {
    return {
      logAdminAction: async () => {},
      logCaseListViewed: async () => {},
    };
  }

  if (request === '../services/productAudit.service') {
    return {
      writeSettingsAudit: async () => {},
      listSettingsAudit: async () => ({ rows: [], pagination: {} }),
    };
  }

  if (request === '../services/settingsAudit.service') {
    return {
      logConfigChange: async () => {
        throw new Error('settings audit offline');
      },
      logWorkflowChange: async () => {},
    };
  }

  if (request === '../utils/log') {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
  }

  if (request === '../services/storage/resolveFirmStorageState') {
    return {
      resolveFirmStorageState: () => ({
        isFirmConnected: true,
        connectionStatus: 'ACTIVE_BYOS',
        isManaged: false,
        mode: 'firm_connected',
      }),
    };
  }

  if (request === '../services/strictStorageAudit.service') {
    return {
      EVENTS: { ENABLED: 'ENABLED', DISABLED: 'DISABLED', BYOS_REQUIRED: 'BYOS_REQUIRED' },
      logStrictStorageEvent: () => {},
    };
  }

  if (request === '../services/diagnostics.service') return { getDiagnosticsSnapshot: async () => ({}) };
  if (request === '../services/softDelete.service') return { restoreDocument: async () => ({}), buildDiagnostics: async () => ({}) };
  if (request === '../services/tenantCaseMetrics.service') return { getLatestTenantMetrics: async () => ({}) };
  if (request === '../repositories/user.repository') return {};
  if (request === '../repositories/client.repository') return {};
  if (request === '../repositories/category.repository') return {};
  if (request === '../utils/tenantGuard') return { assertFirmContext: () => {} };
  if (request === '../utils/hierarchy.utils') return { assertPrimaryAdmin: () => {}, getTagValidationError: () => null, normalizeId: (value) => value };
  if (request === '../services/adminActionAudit.service') return { logAuditEvent: async () => {}, getAuditLogs: async () => [] };
  if (request === '../services/featureFlags.service') return { isExternalStorageEnabled: () => false };
  if (request === '../utils/encryption') return { safeDecrypt: (value) => value };
  if (request === '../services/email.service') return {};
  if (request === '../domain/case/caseStatus') return {};

  return originalLoad.apply(this, arguments);
};

(async () => {
  try {
    delete require.cache[require.resolve('../src/controllers/admin.controller')];
    const adminController = require('../src/controllers/admin.controller');

    const req = {
      method: 'PUT',
      url: '/api/admin/firm-settings',
      originalUrl: '/api/admin/firm-settings',
      skipTransaction: true,
      ownershipFirmId: mockFirm._id,
      user: {
        _id: '507f1f77bcf86cd799439012',
        xID: 'X000001',
        role: 'PRIMARY_ADMIN',
        firmId: mockFirm._id,
      },
      firmId: mockFirm._id,
      body: {
        firm: {
          ...mockFirm.settings.firm,
          slaHolidayDates: ['2026-08-15'],
        },
      },
    };
    const res = createRes();

    await adminController.updateFirmSettings(req, res, () => {});

    assert.strictEqual(res.statusCode, 200, 'updateFirmSettings should still succeed when a secondary audit write fails');
    assert.strictEqual(res.payload?.success, true, 'updateFirmSettings should return success:true');
    assert.deepStrictEqual(
      res.payload?.data?.firm?.slaHolidayDates,
      ['2026-08-15'],
      'updated firm settings should still be returned',
    );

    console.log('updateFirmSettingsResilientAudits.test.js passed');
  } finally {
    Module._load = originalLoad;
  }
})().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exit(1);
});
