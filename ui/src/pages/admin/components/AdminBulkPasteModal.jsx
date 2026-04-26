import { Modal } from '../../../components/common/Modal';
import { Textarea } from '../../../components/common/Textarea';
import { Button } from '../../../components/common/Button';

export const AdminBulkPasteModal = ({
  isOpen,
  onClose,
  mode,
  input,
  onInputChange,
  onSubmit,
  inProgress,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={() => {
      if (inProgress) return;
      onClose();
    }}
    title={mode === 'clients' ? 'Bulk Paste Clients' : mode === 'subcategories' ? 'Bulk Paste Subcategories' : 'Bulk Paste Categories'}
  >
    <form onSubmit={onSubmit} className="admin__create-form">
      <div className="admin__readonly-value">
        {mode === 'clients'
          ? 'Paste rows from Excel/Sheets. Columns: BusinessName, BusinessEmail, PrimaryContactNumber, BusinessAddress (optional), PAN (optional), CIN (optional), TAN (optional), GST (optional).'
          : mode === 'subcategories'
            ? 'Paste 3 columns: CategoryName, SubcategoryName, Workbasket (name or id).'
            : 'Paste one category name per line (or first column). Duplicate names are skipped.'}
      </div>
      <Textarea
        label="Paste Data"
        rows={10}
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder={mode === 'clients'
          ? 'Acme Pvt Ltd\tops@acme.com\t9876543210\tMumbai'
          : mode === 'subcategories'
            ? 'Tax\tGST Filing'
            : 'Tax'}
        required
      />
      <div className="admin__modal-actions">
        <Button type="button" variant="default" onClick={onClose} disabled={inProgress}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={inProgress}>{inProgress ? 'Saving...' : 'Save Bulk Data'}</Button>
      </div>
    </form>
  </Modal>
);
