import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Textarea } from '../../../components/common/Textarea';
import { Button } from '../../../components/common/Button';
import { FormLabel } from '../../../components/common/FormLabel';

export const AdminClientModals = ({
  showClientModal,
  handleCloseClientModal,
  selectedClient,
  handleUpdateClient,
  handleCreateClient,
  clientForm,
  setClientForm,
  uploadingFactSheetFile,
  handleUploadFactSheetFile,
  factSheetFiles,
  handleDeleteFactSheetFile,
  submitting,
  showChangeNameModal,
  handleCloseChangeNameModal,
  handleChangeLegalName,
  changeNameForm,
  setChangeNameForm,
}) => (
  <>
    <Modal
      isOpen={showClientModal}
      onClose={handleCloseClientModal}
      title={selectedClient ? 'Edit Client' : 'Create New Client'}
    >
      <form onSubmit={selectedClient ? handleUpdateClient : handleCreateClient} className="admin__create-form">
        {selectedClient && (
          <div className="admin__readonly-group">
            <label className="admin__readonly-label">Client ID</label>
            <div className="admin__readonly-value">{selectedClient.clientId} (Immutable)</div>
          </div>
        )}

        <Input
          label="Client Name"
          name="businessName"
          value={clientForm.businessName}
          onChange={(e) => setClientForm({ ...clientForm, businessName: e.target.value })}
          placeholder="Enter client name"
          required
          disabled={!!selectedClient}
          title={selectedClient ? 'Business name cannot be edited inline. Use "Change Legal Name" action.' : ''}
        />

        {selectedClient && (
          <div className="client-field-hint">
            To change business name, use the "Change Legal Name" button for audit compliance
          </div>
        )}

        <Input
          label="Business Address (Optional)"
          name="businessAddress"
          value={clientForm.businessAddress}
          onChange={(e) => setClientForm({ ...clientForm, businessAddress: e.target.value })}
          placeholder="Enter business address"
          disabled={!!selectedClient}
          title={selectedClient ? 'Address cannot be changed after creation' : ''}
        />

        <Input
          label="Client Phone Number"
          name="primaryContactNumber"
          type="tel"
          value={clientForm.primaryContactNumber}
          onChange={(e) => setClientForm({ ...clientForm, primaryContactNumber: e.target.value })}
          placeholder="Enter client phone number"
          required
        />

        <Input
          label="Secondary Contact Number"
          name="secondaryContactNumber"
          type="tel"
          value={clientForm.secondaryContactNumber}
          onChange={(e) => setClientForm({ ...clientForm, secondaryContactNumber: e.target.value })}
          placeholder="Enter secondary contact number (optional)"
        />

        <Input
          label="Client Email"
          name="businessEmail"
          type="email"
          value={clientForm.businessEmail}
          onChange={(e) => setClientForm({ ...clientForm, businessEmail: e.target.value })}
          placeholder="Enter client email"
          required
        />

        <Input
          label="PAN"
          name="PAN"
          value={clientForm.PAN}
          onChange={(e) => setClientForm({ ...clientForm, PAN: e.target.value })}
          placeholder="Enter PAN (optional)"
          disabled={!!selectedClient}
          title={selectedClient ? 'PAN is immutable and cannot be changed' : ''}
        />

        <Input
          label="TAN"
          name="TAN"
          value={clientForm.TAN}
          onChange={(e) => setClientForm({ ...clientForm, TAN: e.target.value })}
          placeholder="Enter TAN (optional)"
          disabled={!!selectedClient}
          title={selectedClient ? 'TAN is immutable and cannot be changed' : ''}
        />

        <Input
          label="CIN"
          name="CIN"
          value={clientForm.CIN}
          onChange={(e) => setClientForm({ ...clientForm, CIN: e.target.value })}
          placeholder="Enter CIN (optional)"
          disabled={!!selectedClient}
          title={selectedClient ? 'CIN is immutable and cannot be changed' : ''}
        />

        <Input
          label="GST"
          name="GST"
          value={clientForm.GST}
          onChange={(e) => setClientForm({ ...clientForm, GST: e.target.value })}
          placeholder="Enter GST (optional)"
          disabled={!!selectedClient}
          title={selectedClient ? 'GST cannot be changed after creation' : ''}
        />

        {selectedClient && (
          <>
            <div style={{ marginTop: '2rem', marginBottom: '1rem', borderTop: '2px solid var(--dt-border-whisper)', paddingTop: '1rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--dt-text)' }}>Client Fact Sheet</h3>
            </div>

            <Textarea
              label="Description"
              value={clientForm.description}
              onChange={(e) => setClientForm({ ...clientForm, description: e.target.value })}
              placeholder="Add a description for this client (visible to all case-accessible users)"
              rows={4}
            />

            <Textarea
              label="Internal Notes"
              value={clientForm.notes}
              onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              placeholder="Add internal notes (visible to all case-accessible users)"
              rows={4}
            />

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Files
              </label>
              <input
                type="file"
                onChange={handleUploadFactSheetFile}
                disabled={uploadingFactSheetFile}
                style={{ marginBottom: '1rem' }}
              />
              {uploadingFactSheetFile && <p style={{ fontSize: '0.9rem', color: 'var(--dt-text-muted)' }}>Uploading...</p>}

              {factSheetFiles && factSheetFiles.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {factSheetFiles.map((file) => (
                    <div
                      key={file.fileId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        background: 'var(--dt-surface-muted)',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>📄 {file.fileName}</span>
                      <Button
                        variant="default"
                        onClick={() => handleDeleteFactSheetFile(file.fileId)}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={handleCloseClientModal}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (selectedClient ? 'Updating...' : 'Creating...') : (selectedClient ? 'Update Client' : 'Create Client')}
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      isOpen={showChangeNameModal}
      onClose={handleCloseChangeNameModal}
      title="Change Client Legal Name"
    >
      <form onSubmit={handleChangeLegalName} className="admin__create-form">
        {selectedClient && (
          <>
            <div className="admin__readonly-group">
              <label className="admin__readonly-label">Client ID</label>
              <div className="admin__readonly-value">{selectedClient.clientId}</div>
            </div>

            <div className="admin__readonly-group">
              <label className="admin__readonly-label">Current Business Name</label>
              <div className="admin__readonly-value client-current-name">{selectedClient.businessName}</div>
            </div>
          </>
        )}

        <div className="client-warning-box">
          <strong>⚠️ Important:</strong> Changing a client's legal name is a significant action.
          This change will be permanently recorded in the audit trail with your user ID and the reason provided.
        </div>

        <Input
          label="New Business Name"
          name="newBusinessName"
          value={changeNameForm.newBusinessName}
          onChange={(e) => setChangeNameForm({ ...changeNameForm, newBusinessName: e.target.value })}
          placeholder="Enter new business name"
          required
        />

        <div className="admin__readonly-group">
          <FormLabel label="Reason for Name Change" required />
          <textarea
            name="reason"
            value={changeNameForm.reason}
            onChange={(e) => setChangeNameForm({ ...changeNameForm, reason: e.target.value })}
            placeholder="Enter reason for legal name change (e.g., merger, rebranding, legal restructuring)"
            required
            rows="4"
            className="client-reason-textarea"
          />
        </div>

        <div className="admin__modal-actions">
          <Button type="button" variant="default" onClick={handleCloseChangeNameModal}>Cancel</Button>
          <Button type="submit" variant="warning" disabled={submitting}>{submitting ? 'Changing Name...' : 'Confirm Name Change'}</Button>
        </div>
      </form>
    </Modal>
  </>
);
