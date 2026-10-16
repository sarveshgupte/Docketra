import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';

export const TraineeShieldOtpModal = ({
  isOpen,
  onClose,
  userName,
  userXid,
  targetSettingLabel,
  onVerify,
  onResendOtp,
  loading = false,
  resending = false,
}) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (otp.trim().length < 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setError(null);
    try {
      await onVerify(otp.trim());
      setOtp('');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP. Please try again.');
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await onResendOtp();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not resend OTP right now.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setOtp('');
        setError(null);
        onClose();
      }}
      title="Partner OTP Verification"
      size="sm"
    >
      <div className="space-y-4 text-slate-800">
        <p className="text-sm text-slate-600 leading-relaxed">
          You are changing the <strong>Trainee Laptop Shield</strong> for <strong>{userName}</strong> ({userXid}) to <strong>{targetSettingLabel}</strong>.
        </p>

        <p className="text-xs text-slate-500">
          For sovereign data security, enter the 6-digit OTP sent to your registered partner email to authorize this change.
        </p>

        <div>
          <label htmlFor="trainee-shield-otp-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Enter 6-Digit OTP
          </label>
          <input
            id="trainee-shield-otp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(digits);
              if (error) setError(null);
            }}
            placeholder="000000"
            className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2.5 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>

        {error ? (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resending || loading}
          >
            {resending ? 'Sending code...' : 'Resend OTP'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setOtp('');
                setError(null);
                onClose();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleVerify}
              loading={loading}
              disabled={otp.trim().length < 6 || loading}
            >
              Verify & Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
