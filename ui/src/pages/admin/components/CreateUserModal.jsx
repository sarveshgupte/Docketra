import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { FormLabel } from '../../../components/common/FormLabel';
import { Button } from '../../../components/common/Button';
import { ADMIN_ROLE_HELP, ADMIN_ROLE_DESCRIPTIONS } from '../adminRoleCopy';

const toggleInArray = (value, values = []) => (
  values.includes(value) ? values.filter((id) => id !== value) : [...values, value]
);

export const CreateUserModal = ({
  isOpen,
  onClose,
  onSubmit,
  newUser,
  setNewUser,
  creatingUser,
  primaryWorkbaskets,
  qcOnlyWorkbaskets,
  workbasketLoadWarning,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Create New User">
    <form onSubmit={onSubmit} className="admin__create-form">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-800">xID (Auto-Generated)</label>
        <div className="text-xs text-gray-600">Employee ID will be automatically generated (e.g., X000001)</div>
      </div>

      <Input label="Name" type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" required />
      <Input label="Email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john.doe@company.com" required />
      <Select
        label="Role"
        value={newUser.role}
        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
        options={[
          { value: '', label: 'Select Role', disabled: true },
          { value: 'ADMIN', label: 'Admin' },
          { value: 'MANAGER', label: 'Manager' },
          { value: 'USER', label: 'Employee' },
        ]}
        required
      />
      <div className="text-xs text-gray-600">Role hierarchy: {ADMIN_ROLE_HELP.hierarchy}. {ADMIN_ROLE_HELP.superAdminNote}</div>
      <ul className="mt-2 space-y-1 text-xs text-gray-600">
        {ADMIN_ROLE_DESCRIPTIONS.map((entry) => <li key={entry.role}><strong>{entry.role}:</strong> {entry.description}</li>)}
      </ul>

      <Input label="Department" type="text" value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} placeholder="e.g., Operations" />
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-800">QC Sampling Rate Override (Optional)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={newUser.qcSamplingRate !== null && newUser.qcSamplingRate !== undefined ? newUser.qcSamplingRate : ''}
            onChange={(e) => {
              const val = e.target.value;
              setNewUser({
                ...newUser,
                qcSamplingRate: val === '' ? null : Math.min(100, Math.max(0, parseInt(val, 10) || 0))
              });
            }}
            placeholder="Use category default rate"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-600">%</span>
        </div>
        <p className="text-xs text-gray-500">
          Leave empty to use category/subcategory rates. Specify 100% for trainees, or 10% for seniors.
        </p>
      </div>

      <div className="space-y-2">
        <FormLabel>Workbaskets (at least one)</FormLabel>
        {workbasketLoadWarning ? <div className="text-xs text-amber-700">{workbasketLoadWarning}</div> : null}
        <div className="admin__client-access-list">
          {primaryWorkbaskets.map((workbasket) => (
            <label key={workbasket._id} className="admin__client-access-item">
              <input
                type="checkbox"
                checked={(newUser.teamIds || []).includes(String(workbasket._id))}
                disabled={Boolean(workbasketLoadWarning)}
                onChange={() => setNewUser((prev) => ({ ...prev, teamIds: toggleInArray(String(workbasket._id), Array.isArray(prev.teamIds) ? prev.teamIds : []) }))}
              />
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
                <input
                  type="checkbox"
                  checked={(newUser.teamIds || []).includes(String(workbasket._id))}
                  disabled={Boolean(workbasketLoadWarning)}
                onChange={() => setNewUser((prev) => ({ ...prev, teamIds: toggleInArray(String(workbasket._id), Array.isArray(prev.teamIds) ? prev.teamIds : []) }))}
                />
                <span>{workbasket.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin__form-actions">
        <Button type="button" variant="default" onClick={onClose} disabled={creatingUser}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={creatingUser || Boolean(workbasketLoadWarning) || (newUser.teamIds || []).length === 0}>{creatingUser ? 'Creating...' : 'Create User'}</Button>
      </div>
    </form>
  </Modal>
);
