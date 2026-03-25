/**
 * Client Fact Sheet Modal Component
 * 
 * Displays client fact sheet in read-only mode from case view
 * Shows description, notes, and files with view-only access
 * No download option for files
 * 
 * PR: Client Fact Sheet Foundation
 */

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { API_BASE_URL } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatDateTime';
import './ClientFactSheetModal.css';

export const ClientFactSheetModal = ({ isOpen, onClose, factSheet, caseId, client }) => {
  if (!isOpen || !factSheet) return null;

  const handleViewFile = (fileId) => {
    const viewUrl = `${API_BASE_URL}/cases/${caseId}/client-fact-sheet/files/${fileId}/view`;
    window.open(viewUrl, '_blank');
  };

  const attachments = factSheet.attachments || factSheet.files || [];
  const hasContent = factSheet.description || (attachments && attachments.length > 0);
  const businessName = factSheet.businessName || client?.businessName;
  const clientId = factSheet.clientId || client?.clientId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Fact Sheet"
      maxWidth="4xl"
      actions={(
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      )}
    >
      <div className="client-fact-sheet-modal">
        <div className="client-fact-sheet-header">
          <h3>{businessName}</h3>
          <p className="client-id">{clientId}</p>
        </div>

        {!hasContent && (
          <div className="no-content">
            <p>No fact sheet information available for this client.</p>
          </div>
        )}

        <div className="client-fact-sheet-grid">
          <div className="fact-sheet-section">
            <h4>Description</h4>
            <div className="fact-sheet-updated-at">
              Updated: {factSheet.updatedAt ? formatDateTime(factSheet.updatedAt) : 'Never'}
            </div>
            <div className="fact-sheet-content notes">
              {factSheet.description || 'No description provided.'}
            </div>
          </div>

          <div className="fact-sheet-section">
            <h4>Documents</h4>
            <div className="files-list">
              {attachments.length === 0 ? <p className="file-date">No documents attached.</p> : attachments.map((file) => (
                <div key={file.fileId} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <span className="file-name">{file.fileName}</span>
                      <span className="file-date">
                        Attached On: {file.uploadedAt ? formatDateTime(file.uploadedAt) : '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-view-file"
                    onClick={() => handleViewFile(file.fileId)}
                    title="View or download file (opens in new tab)"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
