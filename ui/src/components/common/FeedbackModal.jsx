import React, { useState, useEffect, useRef, useCallback } from 'react';
import { feedbackService } from '../../services/feedbackService';
import { useAuth } from '../../hooks/useAuth';

const FEEDBACK_TYPES = [
  { id: 'BUG', label: 'Bug Report', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'FEEDBACK', label: 'General Feedback', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'ERROR', label: 'System Error', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'OTHER', label: 'Other', badge: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
];

/**
 * Resize image client-side to ensure lightweight base64 payloads
 */
const compressImage = (file, maxWidth = 1280, maxHeight = 1280, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const FeedbackModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [type, setType] = useState('FEEDBACK');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setType('FEEDBACK');
      setMessage('');
      setScreenshot(null);
      setScreenshotName('');
      setSubmitting(false);
      setError('');
      setSuccessResult(null);
    }
  }, [isOpen]);

  // Handle Ctrl+V paste for screenshot
  const handlePaste = useCallback(async (e) => {
    if (!isOpen || successResult) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImage(file);
            setScreenshot(compressed);
            setScreenshotName(`Clipboard Screenshot (${new Date().toLocaleTimeString()})`);
          } catch (err) {
            console.error('Failed to process pasted image:', err);
          }
          break;
        }
      }
    }
  }, [isOpen, successResult]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setScreenshot(compressed);
      setScreenshotName(file.name);
      setError('');
    } catch (err) {
      setError('Failed to process image attachment.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file);
        setScreenshot(compressed);
        setScreenshotName(file.name);
        setError('');
      } catch (err) {
        setError('Failed to process dropped image.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please provide a message describing your feedback or issue.');
      return;
    }
    if (trimmed.length < 5) {
      setError('Message must be at least 5 characters long.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await feedbackService.submitFeedback({
        type,
        message: trimmed,
        pageUrl: window.location.href,
        screenshot,
      });

      setSuccessResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unable to submit feedback. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 id="feedback-modal-title" className="text-base font-semibold text-slate-900">
              {successResult ? 'Feedback Submitted' : 'Submit Feedback or Report Bug'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {successResult
                ? 'Thank you for helping us improve DocketsHQ'
                : 'Direct channel to DocketsHQ platform engineering and admins'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        {successResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Thank you for your feedback!</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Your report has been received by our engineering and superadmin team.
              </p>
              <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono font-medium text-slate-700">
                <span>Reference ID:</span>
                <span className="text-indigo-600 font-semibold">{successResult.feedbackId}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When our team responds to your submission, you will receive an update email at{' '}
              <strong className="text-slate-600 font-medium">{user?.email || 'your registered email'}</strong>.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 flex items-start gap-2">
                <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FEEDBACK_TYPES.map((cat) => {
                  const active = type === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        active
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <svg className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                      </svg>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Description */}
            <div>
              <label htmlFor="feedback-message" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="feedback-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what happened, what went wrong, or what you'd like to see improved..."
                className="w-full text-sm text-slate-800 placeholder-slate-400 bg-white border border-slate-200 rounded-lg p-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                autoFocus
              />
              <div className="flex justify-between items-center mt-1 text-2xs text-slate-400">
                <span>Minimum 5 characters</span>
                <span>{message.length} characters</span>
              </div>
            </div>

            {/* Screenshot attachment & paste zone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Screenshot (Optional)
                </label>
                <span className="text-2xs text-indigo-600 font-medium">Tip: Press Ctrl+V to paste screenshot</span>
              </div>

              {screenshot ? (
                <div className="relative border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={screenshot}
                      alt="Attachment Preview"
                      className="w-14 h-14 object-cover rounded-md border border-slate-200 bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{screenshotName || 'Screenshot attached'}</p>
                      <p className="text-2xs text-slate-400 mt-0.5">Ready for upload (auto-compressed)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshot(null);
                      setScreenshotName('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors"
                    title="Remove attachment"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-slate-600 font-medium">
                      Click to upload, drag and drop, or press <kbd className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded text-2xs font-mono">Ctrl+V</kbd> to paste
                    </p>
                    <p className="text-2xs text-slate-400">PNG, JPG, or WebP up to 5MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* User Meta Information summary */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400">
              <div className="flex items-center gap-1.5 truncate">
                <span>Submitting as:</span>
                <span className="font-medium text-slate-600">{user?.name || user?.xID || 'User'}</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-500">{user?.xID}</span>
              </div>
              <span className="shrink-0">{user?.email}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || message.trim().length < 5}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Submitting…</span>
                  </>
                ) : (
                  <span>Send Feedback</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
