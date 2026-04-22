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
  clients,
  restrictedClientDraft,
  isClientAllowedForDraft,
  onToggleClientAccess,
  onSave,
  saving,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`User Access & Workbasket Mapping${selectedUser ? ` — ${selectedUser.name}` : ''}`}>
    <div className="admin__create-form">
      <div className="neo-info-text">Select workbaskets and clients for this user. At least one workbasket is required.</div>
      <div className="neo-form-group">
        <FormLabel>Workbaskets (at least one)</FormLabel>
        <div className="admin__client-access-list">
          {primaryWorkbaskets.map((workbasket) => (
            <label key={workbasket._id} className="admin__client-access-item">
              <input type="checkbox" checked={selectedWorkbasketDraft.includes(String(workbasket._id))} onChange={() => setSelectedWorkbasketDraft((prev) => toggleInArray(String(workbasket._id), prev))} />
              <span>{workbasket.name}</span>
            </label>
          ))}
        </div>
      </div>

      {qcOnlyWorkbaskets.length > 0 ? (
        <div className="neo-form-group">
          <FormLabel>QC Access (optional)</FormLabel>
          <div className="admin__client-access-list">
            {qcOnlyWorkbaskets.map((workbasket) => (
              <label key={workbasket._id} className="admin__client-access-item">
                <input type="checkbox" checked={selectedWorkbasketDraft.includes(String(workbasket._id))} onChange={() => setSelectedWorkbasketDraft((prev) => toggleInArray(String(workbasket._id), prev))} />
                <span>{workbasket.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin__access-summary">
        {clients.length === 0 ? (
          <Badge status="Pending">No Clients Found</Badge>
        ) : restrictedClientDraft.length === 0 ? (
          <Badge status="Approved">All Clients Allowed</Badge>
        ) : (
          <Badge status="Pending">{clients.length - restrictedClientDraft.length} of {clients.length} clients allowed</Badge>
        )}
      </div>

      <div className="admin__client-access-list">
        {clients.length === 0 ? (
          <div className="neo-info-text">No clients available yet.</div>
        ) : (
          clients.map((client) => (
            <label key={client.clientId} className="admin__client-access-item">
              <input type="checkbox" checked={isClientAllowedForDraft(client.clientId)} onChange={() => onToggleClientAccess(client.clientId)} />
              <span><strong>{client.businessName}</strong> ({client.clientId})</span>
              <Badge status={isClientAllowedForDraft(client.clientId) ? 'Approved' : 'Rejected'}>{isClientAllowedForDraft(client.clientId) ? 'Allowed' : 'Blocked'}</Badge>
            </label>
          ))
        )}
      </div>

      <div className="admin__form-actions">
        <Button type="button" variant="default" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" disabled={saving || selectedWorkbasketDraft.length === 0} onClick={onSave}>{saving ? 'Saving...' : 'Save Access'}</Button>
      </div>
    </div>
  </Modal>
);
