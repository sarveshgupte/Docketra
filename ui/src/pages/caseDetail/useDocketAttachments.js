import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    let isMounted = true;
    if (!caseId) {
      setUploadLinkResult(null);
      return;
    }

    const fetchActiveLink = async () => {
      try {
        const response = await caseApi.getUploadLinkStatus(caseId);
        if (!isMounted) return;
        if (response?.data && response.data.status === 'ACTIVE') {
          setUploadLinkResult(response.data);
        } else {
          setUploadLinkResult(null);
        }
      } catch (err) {
        console.warn('Failed to load active upload link status:', err);
      }
    };

    fetchActiveLink();
    return () => {
      isMounted = false;
    };
  }, [caseId]);

  const handleUploadFile = useCallback(async (e, options = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    const fileToUpload = options?.file || selectedFile;
    const descToUse = (options?.description !== undefined ? options.description : fileDescription).trim();
    if (!fileToUpload || !descToUse) {
      showWarning('Please select a file and provide a description');
      return;
    }
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const uploadedFile = fileToUpload;
      const description = descToUse;
      const source = options?.source || 'upload';
      const note = options?.note;
      await caseApi.addAttachment(caseId, uploadedFile, description, ({ percent }) => setUploadProgress(percent), { source, note });
      const newFileObj = {
        _id: Date.now().toString(), fileName: uploadedFile.name, filename: uploadedFile.name, description,
        uploadedBy: user?.email || 'System', createdBy: user?.email || 'System', createdByName: user?.name || null,
        createdByXID: user?.xID || null, uploadedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        source,
      };
      setCaseData((prev) => ({ ...prev, attachments: [...(prev?.attachments || []), newFileObj] }));
      if (!options?.file) {
        setSelectedFile(null);
        setFileDescription('');
      }
      const message = (source === 'WHATSAPP_FORWARD' || source === 'whatsapp_forward')
        ? `WhatsApp document bridged to docket ${caseId} • ${formatDateTime()}`
        : `Attachment added to docket ${caseId} • ${formatDateTime()}`;
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
    if (!caseId) return null;
    setUploadLinkGenerating(true);
    try {
      const response = await caseApi.generateUploadLink(caseId, payload);
      const data = response?.data || null;
      setUploadLinkResult(data);
      showSuccess('Document request link generated.');
      return data;
    } catch (error) {
      showError(extractErrorMessage(error, 'Unable to generate document request link.'));
      return null;
    } finally {
      setUploadLinkGenerating(false);
    }
  }, [caseId, showError, showSuccess]);

  return { selectedFile, setSelectedFile, fileDescription, setFileDescription, uploadingFile, uploadProgress, uploadLinkGenerating, uploadLinkResult, handleUploadFile, handleGenerateUploadLink };
};
