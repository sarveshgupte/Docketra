import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Button } from '../components/common/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCard } from '../components/layout/SectionCard';
import { caseService } from '../services/caseService';
import { getFirmConfig, setFirmConfig } from '../utils/firmConfig';
import { formatDateTime } from '../utils/formatDateTime';
import './FirmSettingsPage.css';

export const FirmSettingsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [config, setConfig] = useState(getFirmConfig());
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const response = await caseService.getCases();
        const records = response?.data || [];
        const mockActivity = records
          .flatMap((record) => {
            const auditLog = record.auditLog || [];
            if (auditLog.length) {
              return auditLog
                .filter((entry) => String(entry.actionType || entry.action || '').toUpperCase().includes('LOGIN'))
                .map((entry) => ({
                  id: entry._id || `${entry.timestamp}-${entry.performedByXID || entry.actorXID || 'user'}`,
                  actor: entry.performedByName || entry.actorXID || entry.performedByXID || 'User',
                  timestamp: entry.timestamp || entry.createdAt,
                }));
            }
            return [{
              id: record.caseId,
              actor: record.updatedByName || record.assignedToName || 'User',
              timestamp: record.updatedAt,
            }];
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
  };

  return (
    <Layout>
      <div className="firm-settings">
        <PageHeader
          title="Firm Settings"
          description="Configure operational defaults and feature visibility for this firm."
          actions={<Button variant="primary" onClick={handleSave}>Save Settings</Button>}
        />

        <SectionCard title="Operational Configuration">
          <div className="firm-settings__grid">
            <label>
              SLA default days
              <input
                type="number"
                min="1"
                value={config.slaDefaultDays}
                onChange={(e) => setConfig((prev) => ({ ...prev, slaDefaultDays: e.target.value }))}
              />
            </label>
            <label>
              Escalation inactivity threshold (hours)
              <input
                type="number"
                min="1"
                value={config.escalationInactivityThresholdHours}
                onChange={(e) => setConfig((prev) => ({ ...prev, escalationInactivityThresholdHours: e.target.value }))}
              />
            </label>
            <label>
              Workload threshold
              <input
                type="number"
                min="1"
                value={config.workloadThreshold}
                onChange={(e) => setConfig((prev) => ({ ...prev, workloadThreshold: e.target.value }))}
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="View & Action Controls">
          <div className="firm-settings__toggles">
            <label><input type="checkbox" checked={config.enablePerformanceView} onChange={(e) => setConfig((prev) => ({ ...prev, enablePerformanceView: e.target.checked }))} /> Enable Performance View</label>
            <label><input type="checkbox" checked={config.enableEscalationView} onChange={(e) => setConfig((prev) => ({ ...prev, enableEscalationView: e.target.checked }))} /> Enable Escalation View</label>
            <label><input type="checkbox" checked={config.enableBulkActions} onChange={(e) => setConfig((prev) => ({ ...prev, enableBulkActions: e.target.checked }))} /> Enable Bulk Actions</label>
          </div>
        </SectionCard>

        <SectionCard title="Recent User Activity" subtitle="Last 10 login events (mocked from available audit activity)">
          {activity.length ? (
            <ul className="firm-settings__activity-list">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.actor}</strong> · {formatDateTime(entry.timestamp)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="firm-settings__empty">No recent activity available.</p>
          )}
        </SectionCard>

        <div className="firm-settings__footer">
          <Button variant="outline" onClick={() => navigate(`/app/firm/${firmSlug}/admin`)}>Back to Admin</Button>
        </div>
      </div>
    </Layout>
  );
};

