import React, { useState, useEffect } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Select } from '../components/common/Select';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';

const genderOptions = [
  { value: '', label: 'Select gender', disabled: true },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: '',
    phone: '',
    address: '',
    panMasked: '',
    aadhaarMasked: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setProfileData(user);
    setFormData({
      dateOfBirth: user.dateOfBirth || '',
      gender: user.gender || '',
      phone: user.phone || '',
      address: user.address || '',
      panMasked: user.panMasked || '',
      aadhaarMasked: user.aadhaarMasked || '',
    });
    setLoading(false);
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await authService.updateProfile(formData);

      if (response.success) {
        setSuccess('Profile updated successfully.');
        setEditing(false);
        setProfileData(response.data);
        updateUser(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setSuccess('');

    if (profileData) {
      setFormData({
        dateOfBirth: profileData.dateOfBirth || '',
        gender: profileData.gender || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        panMasked: profileData.panMasked || '',
        aadhaarMasked: profileData.aadhaarMasked || '',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading profile..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen w-full flex-1 bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">My Profile</h1>
            <p className="text-sm text-gray-500">View and update your personal account information.</p>
          </div>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-gray-900">Identity</h2>
              <p className="text-sm text-gray-500">These fields are managed by your organization and cannot be edited here.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input label="Employee ID (xID)" value={profileData?.xID || ''} readOnly />
                <Input label="Role" value={profileData?.role || ''} readOnly />
                <Input label="Name" value={profileData?.name || ''} readOnly />
                <Input label="Email" value={profileData?.email || ''} readOnly />
                {profileData?.firm ? (
                  <Input label="Firm" value={profileData.firm.name || ''} readOnly className="sm:col-span-2" />
                ) : null}
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
              <p className="text-sm text-gray-500">Keep your contact details and masked identity information current.</p>
            </div>
            <Card className="lg:col-span-2 lg:max-w-4xl">
              <form className="space-y-4" onSubmit={handleSave}>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={!editing}
                  />
                  <Select
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    disabled={!editing}
                    options={genderOptions}
                  />
                  <Input
                    label="Phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!editing}
                    placeholder="10-digit mobile number"
                  />
                  <Input
                    label="PAN (Masked)"
                    name="panMasked"
                    value={formData.panMasked}
                    onChange={handleChange}
                    disabled={!editing}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    helpText={editing ? 'Format: ABCDE1234F (masked).' : undefined}
                  />
                  <Input
                    label="Aadhaar (Masked)"
                    name="aadhaarMasked"
                    value={formData.aadhaarMasked}
                    onChange={handleChange}
                    disabled={!editing}
                    placeholder="XXXX-XXXX-1234"
                    className="sm:col-span-2"
                    helpText={editing ? 'Format: XXXX-XXXX-1234 (only the last 4 digits should be visible).' : undefined}
                  />
                  <Textarea
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={!editing}
                    placeholder="Full address"
                    className="sm:col-span-2"
                  />
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

                <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                  {editing ? (
                    <>
                      <Button type="button" variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button variant="primary" type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="primary" onClick={() => setEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </section>
        </div>
      </div>
    </Layout>
  );
};
