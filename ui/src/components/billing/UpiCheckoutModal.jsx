import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { generateUpiQrSvg } from '../../utils/qrCodeGenerator';
import { subscriptionService } from '../../services/subscriptionService';

export const UpiCheckoutModal = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const [utr, setUtr] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [orderStatus, setOrderStatus] = useState(order?.status || 'PENDING');
  const [completedData, setCompletedData] = useState(null);

  // Generate crisp Vector SVG QR code from the order's UPI intent URI
  const qrSvg = useMemo(() => {
    if (!order?.upiUri) return null;
    return generateUpiQrSvg(order.upiUri, 240);
  }, [order?.upiUri]);

  // Sync internal order status when a new order prop arrives
  useEffect(() => {
    if (order) {
      setOrderStatus(order.status || 'PENDING');
      setUtr('');
      setError('');
      setCompletedData(null);
    }
  }, [order]);

  // Real-time status polling every 3.5 seconds
  useEffect(() => {
    if (!isOpen || !order?.orderId || orderStatus === 'COMPLETED' || orderStatus === 'EXPIRED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await subscriptionService.getOrderStatus(order.orderId);
        if (res?.success && res?.data?.status) {
          const current = res.data.status;
          setOrderStatus(current);
          if (current === 'COMPLETED') {
            setCompletedData(res.data);
            if (onSuccess) onSuccess(res.data);
          }
        }
      } catch (err) {
        // Silently tolerate background poll hiccups
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, order?.orderId, orderStatus, onSuccess]);

  const handleCopyVpa = async () => {
    if (!order?.payeeVpa) return;
    try {
      await navigator.clipboard.writeText(order.payeeVpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyAmount = async () => {
    if (!order?.amount) return;
    try {
      await navigator.clipboard.writeText(String(order.amount));
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleVerifyUtr = async (e) => {
    e.preventDefault();
    if (!utr.trim()) {
      setError('Please enter the 12-digit UPI reference number (UTR).');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await subscriptionService.verifyUtr(order.orderId, utr.trim());
      if (res?.success) {
        setOrderStatus('COMPLETED');
        setCompletedData(res.data);
        if (onSuccess) onSuccess(res.data);
      } else {
        setError(res?.message || 'Verification failed. Please check the UTR.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Verification failed. Please check the UTR.');
    } finally {
      setVerifying(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Direct UPI Checkout (0% Gateway Fees)"
      size="md"
    >
      {orderStatus === 'COMPLETED' ? (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Subscription Activated!</h3>
            <p className="mt-1 text-sm text-slate-600">
              Your firm has been upgraded to <strong>{order.planName || order.plan}</strong>.
            </p>
            {completedData?.order?.utr && (
              <p className="mt-2 text-xs font-mono text-slate-500">
                Verified UTR: <span className="text-slate-800 font-semibold">{completedData.order.utr}</span>
              </p>
            )}
          </div>
          <div className="pt-4">
            <Button onClick={onClose} className="w-full">
              Back to Firm Settings
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-slate-800">
          {/* Header Summary Banner */}
          <div className="rounded-sm border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                Plan Selection
              </span>
              <p className="text-sm font-bold text-slate-950">
                {order.planName || order.plan?.toUpperCase()} ({order.billingCycle})
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Order #{order.orderId}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-xs">
                0% Gateway Fee
              </span>
              <p className="text-xl font-extrabold text-slate-950 font-mono mt-0.5">
                ₹{Number(order.amount).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-sm shadow-xs">
            {/* SECURITY: Sanitize SVG payload before injecting to prevent XSS via malformed Intent URIs */}
            <div
              className="w-56 h-56 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qrSvg || '') }}
            />
            <p className="mt-2 text-[11px] font-medium text-slate-500 text-center">
              Scan with any UPI App (GPay, PhonePe, Paytm, BHIM, CRED)
            </p>

            {/* Mobile App Deep Links */}
            <div className="mt-3 flex gap-2 w-full justify-center sm:hidden">
              <a
                href={order.upiUri}
                className="inline-flex items-center justify-center rounded-xs bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
              >
                Open UPI App
              </a>
            </div>
          </div>

          {/* Payee Account Details for Manual Transfer */}
          <div className="space-y-2 text-xs border border-slate-100 rounded-sm p-3 bg-slate-50/50">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Payee Name:</span>
              <span className="font-semibold text-slate-900">{order.payeeName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">UPI ID (VPA):</span>
              <div className="flex items-center gap-1.5">
                <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded-xs text-[11px] font-mono font-semibold text-slate-800">
                  {order.payeeVpa}
                </code>
                <button
                  type="button"
                  onClick={handleCopyVpa}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  {copiedVpa ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Exact Amount:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900">₹{order.amount}</span>
                <button
                  type="button"
                  onClick={handleCopyAmount}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  {copiedAmount ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* UTR Verification Input */}
          <form onSubmit={handleVerifyUtr} className="space-y-2 pt-1 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-900">
              Paid via UPI? Enter 12-digit UTR / Reference ID:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={24}
                placeholder="e.g. 428819283741"
                value={utr}
                onChange={(e) => {
                  setUtr(e.target.value);
                  if (error) setError('');
                }}
                className="flex-1 rounded-xs border border-slate-300 px-3 py-1.5 text-xs font-mono tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden"
              />
              <Button
                type="submit"
                size="small"
                disabled={verifying || !utr.trim()}
              >
                {verifying ? 'Verifying...' : 'Verify & Activate'}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}
            <p className="text-[11px] text-slate-500 leading-normal">
              Found in your UPI app's transaction history under "UPI Ref No" or "UTR". Verification takes less than 2 seconds.
            </p>
          </form>
        </div>
      )}
    </Modal>
  );
};

export default UpiCheckoutModal;
