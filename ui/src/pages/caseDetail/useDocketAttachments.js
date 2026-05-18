import { useCallback, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { extractErrorMessage } from '../../services/apiResponse';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { formatDateTime } from '../../utils/formatDateTime';

export const useDocketAttachments = ({ caseId, user, showSuccess, showError, showWarning, setCaseData, setActionConfirmation, setActionError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLinkGenerating, setUploadLinkGenerating] = useState(false);
  const [uploadLinkResult, setUploadLinkResult] = useState(null);

  const handleUploadFile = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedFile || !fileDescription.trim()) {
      showWarning('Please select a file and provide a description');
      return;
    }
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const uploadedFile = selectedFile;
      const description = fileDescription.trim();
      await caseApi.addAttachment(caseId, uploadedFile, description, ({ percent }) => setUploadProgress(percent));
      const newFileObj = {
        _id: Date.now().toString(), fileName: uploadedFile.name, filename: uploadedFile.name, description,
        uploadedBy: user?.email || 'System', createdBy: user?.email || 'System', createdByName: user?.name || null,
        createdByXID: user?.xID || null, uploadedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      };
      setCaseData((prev) => ({ ...prev, attachments: [...(prev?.attachments || []), newFileObj] }));
      setSelectedFile(null);
      setFileDescription('');
      const message = `Attachment added to docket ${caseId} • ${formatDateTime()}`;
      showSuccess(message);
      setActionConfirmation(message);
      setActionError(null);
    } catch (error) {
      const uploadRecovery = getRecoveryPayload(error, 'docket_attachments_upload');
      const safeMessage = uploadRecovery.copy.message;
      showError(safeMessage);
      setActionError({ message: safeMessage, retry: uploadRecovery.copy.retryAllowed ? handleUploadFile : null, supportContext: uploadRecovery.supportContext });
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  }, [caseId, fileDescription, selectedFile, setActionConfirmation, setActionError, setCaseData, showError, showSuccess, showWarning, user?.email, user?.name, user?.xID]);

  const handleGenerateUploadLink = useCallback(async (payload) => {
    if (!caseId) return;
    setUploadLinkGenerating(true);
    try {
      const response = await caseApi.generateUploadLink(caseId, payload);
      setUploadLinkResult(response?.data || null);
      showSuccess('Document request link generated.');
    } catch (error) {
      showError(extractErrorMessage(error, 'Unable to generate document request link.'));
    } finally {
      setUploadLinkGenerating(false);
    }
  }, [caseId, showError, showSuccess]);

  return { selectedFile, setSelectedFile, fileDescription, setFileDescription, uploadingFile, uploadProgress, uploadLinkGenerating, uploadLinkResult, handleUploadFile, handleGenerateUploadLink };
};
