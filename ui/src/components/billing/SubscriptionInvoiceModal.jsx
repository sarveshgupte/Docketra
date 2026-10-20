import React, { useRef } from 'react';
import { Button } from '../common/Button';

export const SubscriptionInvoiceModal = ({ isOpen, onClose, invoice }) => {
  const printAreaRef = useRef(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Controls Header (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Subscription Tax Invoice & Receipt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable Invoice Document */}
        <div ref={printAreaRef} className="p-8 space-y-6 text-slate-900 bg-white">
          {/* Brand & Invoice Details Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                  D
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">Docketra</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Practice Management for CA, CS & Legal Firms</p>
              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                <p><strong>Merchant:</strong> {invoice.seller?.merchantName || 'Sarvesh Anand Gupte'}</p>
                <p><strong>UPI VPA:</strong> {invoice.seller?.vpa || 'sarveshgupte@oksbi'}</p>
                <p><strong>Email:</strong> {invoice.seller?.email || 'billing@docketra.com'}</p>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="inline-block rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                {invoice.status || 'PAID'}
              </span>
              <h2 className="mt-2 text-lg font-bold text-slate-900">
                {invoice.invoiceNumber || 'INVOICE'}
              </h2>
              <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                <p><strong>Order ID:</strong> {invoice.orderId}</p>
                <p><strong>Date:</strong> {formatDate(invoice.paidAt || invoice.issuedAt)}</p>
              </div>
            </div>
          </div>

          {/* Billed To Customer */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Billed To (Customer Firm)</p>
            <p className="mt-1 text-base font-bold text-slate-900">{invoice.buyer?.firmName}</p>
            <p className="text-xs text-slate-600">Workspace Slug: <code>{invoice.buyer?.firmSlug}</code></p>
          </div>

          {/* Itemized Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Description</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Billing Cycle</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-slate-700">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(invoice.lineItems || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{item.description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{item.details}</p>
                    </td>
                    <td className="px-4 py-3.5 capitalize text-slate-600">
                      {item.cycle || 'Annual'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/90 font-semibold text-slate-900">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right text-xs">Total Paid:</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">
                    ₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN')}.00
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment Details & Bank Reference */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs">
            <p className="font-bold text-slate-800">Transaction & Settlement Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              <div>
                <p><strong>Payment Mode:</strong> {invoice.paymentDetails?.gateway || 'Direct UPI (NPCI)'}</p>
                <p><strong>Merchant VPA:</strong> {invoice.paymentDetails?.payeeVpa || 'sarveshgupte@oksbi'}</p>
              </div>
              <div>
                <p>
                  <strong>Bank UTR / Ref No:</strong>{' '}
                  <span className="font-mono font-medium text-slate-900">
                    {invoice.paymentDetails?.utr || 'Direct Payment Verified'}
                  </span>
                </p>
                <p><strong>Gateway Fee:</strong> ₹0.00 (0% Zero Fee Direct Settlement)</p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
            This is an electronically generated receipt for your Docketra subscription.
            For any billing questions, contact <strong>billing@docketra.com</strong>.
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/80 px-6 py-3 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionInvoiceModal;
