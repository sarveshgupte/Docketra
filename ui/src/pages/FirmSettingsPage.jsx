import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { caseService } from '../services/caseService';
import { getFirmConfig, setFirmConfig } from '../utils/firmConfig';
import { formatDateTime } from '../utils/formatDateTime';

const enabledDisabledOptions = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

export const FirmSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [config, setConfig] = useState(getFirmConfig());
  const [activity, setActivity] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const response = await caseService.getCases();
        const records = response?.data || [];
        const mockActivity = records
          .flatMap((record) => {
            const auditLog = record.auditLog || [];
            if (auditLog.length) {
              return auditLog.map((entry) => ({
                id: entry._id || `${entry.timestamp}-${entry.performedByXID || entry.actorXID || 'user'}`,
                actor: entry.performedByName || entry.actorXID || entry.performedByXID || 'User',
                timestamp: entry.timestamp || entry.createdAt,
              }));
            }
            return [
              {
                id: record.caseId,
                actor: record.updatedByName || record.assignedToName || 'User',
                timestamp: record.updatedAt,
              },
            ];
          })
          .filter((entry) => entry.timestamp)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10);
        setActivity(mockActivity);
      } catch {
        setActivity([]);
      }
    };
    loadActivity();
  }, []);

  const handleNumberChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage('');
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleChange = (event) => {
    const { name, value } = event.target;
    setSaveMessage('');
    setConfig((prev) => ({ ...prev, [name]: value === 'true' }));
  };

  const handleSave = () => {
    const payload = {
      slaDefaultDays: Number(config.slaDefaultDays) || 0,
      escalationInactivityThresholdHours: Number(config.escalationInactivityThresholdHours) || 0,
      workloadThreshold: Number(config.workloadThreshold) || 15,
      enablePerformanceView: Boolean(config.enablePerformanceView),
      enableEscalationView: Boolean(config.enableEscalationView),
      enableBulkActions: Boolean(config.enableBulkActions),
    };
    const saved = setFirmConfig(payload);
    setConfig(saved);
    setSaveMessage('Firm settings saved successfully.');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <PageHeader
            title="Firm Settings"
            description="Configure operational defaults and feature visibility for this firm."
          />

          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Operational Configuration</h2>
                <p className="text-sm text-gray-500">Set the default thresholds that guide case routing, SLAs, and escalation timing.</p>
              </div>
              <div className="space-y-5">
                <Input
                  label="SLA default days"
                  name="slaDefaultDays"
                  type="number"
                  min="1"
                  value={config.slaDefaultDays}
                  onChange={handleNumberChange}
                />
                <Input
                  label="Escalation inactivity threshold (hours)"
                  name="escalationInactivityThresholdHours"
                  type="number"
                  min="1"
                  value={config.escalationInactivityThresholdHours}
                  onChange={handleNumberChange}
                />
                <Input
                  label="Workload threshold"
                  name="workloadThreshold"
                  type="number"
                  min="1"
                  value={config.workloadThreshold}
                  onChange={handleNumberChange}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">View &amp; Action Controls</h2>
                <p className="text-sm text-gray-500">Enable or hide operational views and bulk actions for firm users.</p>
              </div>
              <div className="space-y-5">
                <Select
                  label="Performance View"
                  name="enablePerformanceView"
                  value={String(Boolean(config.enablePerformanceView))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
                <Select
                  label="Escalation View"
                  name="enableEscalationView"
                  value={String(Boolean(config.enableEscalationView))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
                <Select
                  label="Bulk Actions"
                  name="enableBulkActions"
                  value={String(Boolean(config.enableBulkActions))}
                  onChange={handleToggleChange}
                  options={enabledDisabledOptions}
                />
              </div>

              {saveMessage ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{saveMessage}</div> : null}

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(`/app/firm/${firmSlug}/admin`)}>
                  Back to Admin
                </Button>
                <Button type="button" variant="primary" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recent User Activity</h2>
                <p className="text-sm text-gray-500">Last 10 activity records derived from the most recent available audit events.</p>
              </div>
              {activity.length ? (
                <ul className="space-y-3">
                  {activity.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{entry.actor}</span>
                      <span className="mx-2 text-gray-300">•</span>
                      <span>{formatDateTime(entry.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No recent activity available"
                  description="Recent audit events will appear here as your team works on dockets."
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
