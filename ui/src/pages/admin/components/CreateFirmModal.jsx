/**
 * CreateFirmModal
 * Rapid Onboarding Modal for Tenant Firms from Superadmin HUD
 */

import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { superadminService } from '../../../services/superadminService';
import { useToast } from '../../../hooks/useToast';

const toSlug = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const CreateFirmModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slug = toSlug(formData.name);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Firm name is required';
    } else if (formData.name.trim().length < 2) {
      errs.name = 'Firm name must be at least 2 characters';
    }

    if (!formData.adminName.trim()) {
      errs.adminName = 'Primary administrator name is required';
    }

    if (!formData.adminEmail.trim()) {
      errs.adminEmail = 'Primary administrator email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail.trim())) {
      errs.adminEmail = 'Enter a valid corporate email address';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const response = await superadminService.createFirm(
        formData.name.trim(),
        formData.adminName.trim(),
        formData.adminEmail.trim()
      );

      if (response?.success) {
        toast.success(`Firm "${formData.name.trim()}" onboarded successfully. Access email sent to admin.`);
        setFormData({ name: '', adminName: '', adminEmail: '' });
        setErrors({});
        onClose();
        if (onSuccess) {
          onSuccess(response.data);
        }
      } else {
        toast.error(response?.message || 'Failed to onboard firm');
      }
    } catch (error) {
      console.error('Failed to onboard firm:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to onboard firm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ name: '', adminName: '', adminEmail: '' });
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Onboard New Firm"
      size="md"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Provisioning...' : 'Provision Firm'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Firm / Entity Name"
            placeholder="e.g. Acme Associates & Partners"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (errors.name) setErrors({ ...errors, name: null });
            }}
            error={errors.name}
            required
            autoFocus
          />
          {slug && (
            <p className="mt-1 text-[11px] font-mono text-slate-500">
              Workspace URL: <span className="text-slate-800 font-semibold">docketra.in/app/firm/{slug}</span>
            </p>
          )}
        </div>

        <Input
          label="Primary Administrator Name"
          placeholder="e.g. Rajesh Singhania"
          value={formData.adminName}
          onChange={(e) => {
            setFormData({ ...formData, adminName: e.target.value });
            if (errors.adminName) setErrors({ ...errors, adminName: null });
          }}
          error={errors.adminName}
          required
        />

        <Input
          label="Primary Administrator Corporate Email"
          type="email"
          placeholder="rajesh@acmeassociates.com"
          value={formData.adminEmail}
          onChange={(e) => {
            setFormData({ ...formData, adminEmail: e.target.value });
            if (errors.adminEmail) setErrors({ ...errors, adminEmail: null });
          }}
          error={errors.adminEmail}
          helpText="An account activation email with secure credentials will be dispatched immediately."
          required
        />
      </form>
    </Modal>
  );
};
