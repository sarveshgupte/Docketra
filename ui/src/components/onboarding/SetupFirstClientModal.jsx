import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from './OnboardingIcons';
import { clientApi } from '../../api/client.api';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../constants/routes';

const ENTITY_TYPES = [
  'Private Limited Company (Pvt Ltd)',
  'Public Limited Company (Ltd)',
  'Limited Liability Partnership (LLP)',
  'Partnership Firm',
  'Sole Proprietorship',
  'Individual / Director',
];

export function SetupFirstClientModal({ isOpen, onClose, firmSlug }) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    entityType: 'Private Limited Company (Pvt Ltd)',
    CIN: '',
    PAN: '',
    contactPersonName: '',
    businessEmail: '',
    primaryContactNumber: '',
    city: '',
    state: '',
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      showError('Please enter the client / entity name');
      return;
    }

    setLoading(true);
    try {
      const response = await clientApi.createClient({
        businessName: form.businessName.trim(),
        businessEmail: form.businessEmail.trim() || undefined,
        primaryContactNumber: form.primaryContactNumber.trim() || undefined,
        contactPersonName: form.contactPersonName.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        ...(form.CIN.trim() ? { CIN: form.CIN.trim().toUpperCase() } : {}),
        ...(form.PAN.trim() ? { PAN: form.PAN.trim().toUpperCase() } : {}),
      });

      if (response?.success || response?.data?.clientId) {
        const clientId = response?.data?.clientId || response?.clientId;
        showSuccess(`First client "${form.businessName}" created successfully!`);
        if (onClose) onClose();
        if (clientId && firmSlug) {
          navigate(ROUTES.CLIENT_WORKSPACE(firmSlug, clientId));
        } else if (firmSlug) {
          navigate(ROUTES.CLIENTS(firmSlug));
        }
      } else {
        throw new Error(response?.message || 'Failed to create client');
      }
    } catch (err) {
      showError(err?.message || 'Unable to save client. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-lg max-w-xl w-full p-6 sm:p-7 shadow-2xl text-slate-900 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono uppercase font-semibold">
              <Building2 className="h-3 w-3 text-emerald-700" />
              Step 6: First Client
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Add your firm&apos;s first corporate client
            </h2>
            <p className="text-xs text-slate-600">
              Activate your compliance roadmap, statutory due dates, and secretarial registers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Client Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Entity Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Client / Corporate Entity Name <span className="text-amber-700">*</span>
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange('businessName', e.target.value)}
              placeholder="e.g. Acme Technologies Private Limited"
              required
              autoFocus
              className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Entity Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Entity Structure
              </label>
              <select
                value={form.entityType}
                onChange={(e) => handleChange('entityType', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* CIN / LLPIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                CIN / LLPIN (Optional)
              </label>
              <input
                type="text"
                value={form.CIN}
                onChange={(e) => handleChange('CIN', e.target.value)}
                placeholder="e.g. U72200MH2020PTC123456"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contact Person */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Primary Contact / Director
              </label>
              <input
                type="text"
                value={form.contactPersonName}
                onChange={(e) => handleChange('contactPersonName', e.target.value)}
                placeholder="e.g. Vikram Mehta"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Client Email
              </label>
              <input
                type="email"
                value={form.businessEmail}
                onChange={(e) => handleChange('businessEmail', e.target.value)}
                placeholder="contact@client.com"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </div>
          </div>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                City / Jurisdiction
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                State
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              I&apos;ll do this later
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating Client...' : 'Create Client & Open Profile'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SetupFirstClientModal;
