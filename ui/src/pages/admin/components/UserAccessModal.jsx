import { Modal } from '../../../components/common/Modal';
import { FormLabel } from '../../../components/common/FormLabel';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

const toggleInArray = (value, values = []) => (
  values.includes(value) ? values.filter((id) => id !== value) : [...values, value]
);

export const UserAccessModal = ({
  isOpen,
  onClose,
  selectedUser,
  primaryWorkbaskets,
  qcOnlyWorkbaskets,
  selectedWorkbasketDraft,
  setSelectedWorkbasketDraft,
  qcSamplingRateDraft,
  setQcSamplingRateDraft,
  traineeShieldDraft,
  setTraineeShieldDraft,
  isPrimaryAdminActor,
  clients,
  restrictedClientDraft,
  clientAccessModeDraft,
  setClientAccessModeDraft,
  canManageClientAccess,
  isPrimaryAdminTarget,
  isClientAllowedForDraft,
  onToggleClientAccess,
  onSave,
  saving,
  workbasketLoadWarning,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`User Access & Workbasket Mapping${selectedUser ? ` — ${selectedUser.name}` : ''}`}>
    <div className="admin__create-form">
      <div className="text-sm text-gray-600">Select workbaskets and clients for this user. At least one workbasket is required.</div>
      {workbasketLoadWarning ? <div className="text-xs text-amber-700">{workbasketLoadWarning}</div> : null}
      <div className="space-y-2">
        <FormLabel>Workbaskets (at least one)</FormLabel>
        <div className="admin__client-access-list">
          {primaryWorkbaskets.map((workbasket) => (
            <label key={workbasket._id} className="admin__client-access-item">
              <input type="checkbox" disabled={Boolean(workbasketLoadWarning)} checked={selectedWorkbasketDraft.includes(String(workbasket._id))} onChange={() => setSelectedWorkbasketDraft((prev) => toggleInArray(String(workbasket._id), prev))} />
              <span>{workbasket.name}</span>
            </label>
          ))}
        </div>
      </div>

      {qcOnlyWorkbaskets.length > 0 ? (
        <div className="space-y-2">
          <FormLabel>QC Access (optional)</FormLabel>
          <div className="admin__client-access-list">
            {qcOnlyWorkbaskets.map((workbasket) => (
              <label key={workbasket._id} className="admin__client-access-item">
                <input type="checkbox" disabled={Boolean(workbasketLoadWarning)} checked={selectedWorkbasketDraft.includes(String(workbasket._id))} onChange={() => setSelectedWorkbasketDraft((prev) => toggleInArray(String(workbasket._id), prev))} />
                <span>{workbasket.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <FormLabel>QC Sampling Rate Override</FormLabel>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={qcSamplingRateDraft !== null && qcSamplingRateDraft !== undefined ? qcSamplingRateDraft : ''}
            onChange={(e) => {
              const val = e.target.value;
              setQcSamplingRateDraft(val === '' ? null : Math.min(100, Math.max(0, parseInt(val, 10) || 0)));
            }}
            placeholder="Use category default rate"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-600">%</span>
        </div>
        <p className="text-xs text-gray-500">
          Leave blank to use default category/subcategory rates. Specify 100% to send all resolved cases to QC (e.g. for trainees), or a lower rate (e.g. 10%) for experienced team members.
        </p>
      </div>

      <FormLabel>Client access</FormLabel>
      {!canManageClientAccess || isPrimaryAdminTarget ? <div className="text-xs text-gray-600">{isPrimaryAdminTarget ? 'Primary Admin always has all-client access.' : 'You do not have permission to change client access.'}</div> : null}
      <div className="space-y-2">
        <label className="admin__client-access-item"><input type="radio" name="client-access-mode" checked={clientAccessModeDraft === 'ALL'} disabled={!canManageClientAccess || isPrimaryAdminTarget} onChange={() => setClientAccessModeDraft('ALL')} /> <span>All clients</span></label>
        <label className="admin__client-access-item"><input type="radio" name="client-access-mode" checked={clientAccessModeDraft === 'SELECTED'} disabled={!canManageClientAccess || isPrimaryAdminTarget || clients.length === 0} onChange={() => setClientAccessModeDraft('SELECTED')} /> <span>Selected clients only</span></label>
      </div>
      <div className="admin__access-summary">
        {clientAccessModeDraft === 'ALL' ? <Badge status="Approved">All Clients Allowed</Badge> : <Badge status="Pending">{restrictedClientDraft.length} selected client(s)</Badge>}
      </div>

      <div className="admin__client-access-list">
        {clients.length === 0 ? (
          <div className="text-sm text-gray-600">No clients available yet.</div>
        ) : clientAccessModeDraft === 'ALL' ? (
          <div className="text-sm text-gray-600">All clients are currently accessible.</div>
        ) : (
          clients.map((client) => (
            <label key={client.clientId} className="admin__client-access-item">
              <input type="checkbox" disabled={!canManageClientAccess || isPrimaryAdminTarget} checked={isClientAllowedForDraft(client.clientId)} onChange={() => onToggleClientAccess(client.clientId)} />
              <span><strong>{client.businessName}</strong> ({client.clientId})</span>
              <Badge status={isClientAllowedForDraft(client.clientId) ? 'Approved' : 'Pending'}>{isClientAllowedForDraft(client.clientId) ? 'Selected' : 'Not selected'}</Badge>
            </label>
          ))
        )}
      </div>

      <div className="space-y-2 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <FormLabel>Trainee Laptop Shield (Download Restrictions)</FormLabel>
          <Badge
            status={
              traineeShieldDraft === true
                ? 'Error'
                : traineeShieldDraft === false
                  ? 'Approved'
                  : 'Pending'
            }
          >
            {traineeShieldDraft === true
              ? 'Downloads Blocked'
              : traineeShieldDraft === false
                ? 'Downloads Allowed'
                : 'Inherit Firm Default'}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          Prevents article assistants from downloading raw client files to personal laptops. In-app document preview is always allowed.
        </p>

        {!isPrimaryAdminActor ? (
          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            Only the Primary Admin can change Trainee Laptop Shield settings for a user.
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="admin__client-access-item">
            <input
              type="radio"
              name="trainee-shield-setting"
              checked={traineeShieldDraft === null || traineeShieldDraft === undefined}
              disabled={!isPrimaryAdminActor || isPrimaryAdminTarget}
              onChange={() => setTraineeShieldDraft(null)}
            />
            <span>Inherit firm default setting</span>
          </label>
          <label className="admin__client-access-item">
            <input
              type="radio"
              name="trainee-shield-setting"
              checked={traineeShieldDraft === true}
              disabled={!isPrimaryAdminActor || isPrimaryAdminTarget}
              onChange={() => setTraineeShieldDraft(true)}
            />
            <span><strong>Shield Active (Block Downloads)</strong> — Prevent raw file downloads on personal laptop</span>
          </label>
          <label className="admin__client-access-item">
            <input
              type="radio"
              name="trainee-shield-setting"
              checked={traineeShieldDraft === false}
              disabled={!isPrimaryAdminActor || isPrimaryAdminTarget}
              onChange={() => setTraineeShieldDraft(false)}
            />
            <span><strong>Shield Exempt (Allow Downloads)</strong> — Permit file downloads for this staff</span>
          </label>
        </div>

        {isPrimaryAdminActor && (
          <p className="text-[11px] text-indigo-700 font-medium">
            Note: Changing this setting will ask for a 6-digit email OTP verification before saving.
          </p>
        )}
      </div>

      <div className="admin__form-actions">
        <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" disabled={saving || Boolean(workbasketLoadWarning) || selectedWorkbasketDraft.length === 0 || (clientAccessModeDraft === 'SELECTED' && restrictedClientDraft.length === 0)} onClick={onSave}>{saving ? 'Saving...' : 'Save Access'}</Button>
      </div>
    </div>
  </Modal>
);
