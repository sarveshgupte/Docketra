import api from './api';
import { API_BASE_URL } from '../utils/constants';

export async function getStorageConfiguration() {
  const response = await api.get('/storage/configuration');
  return response.data;
}

export async function connectGoogleDrive() {
  const connectUrl = new URL('storage/google/connect', `${API_BASE_URL}/`).toString();
  window.location.assign(connectUrl);
}

export async function testStorageConnection() {
  const response = await api.post('/storage/test-connection');
  return response.data;
}

export async function disconnectStorage() {
  const response = await api.post('/storage/disconnect');
  return response.data;
}

export async function getStorageOwnershipSummary() {
  const response = await api.get('/storage/ownership-summary');
  return response.data;
}

export async function sendStorageChangeOtp(email) {
  // AUTH_CONTRACT_ALLOWLIST: legacy OTP endpoint retained for storage change step-up verification.
  const response = await api.post('/auth/send-otp', {
    email,
    purpose: 'storage_change',
  });
  return response.data;
}

export async function verifyStorageChangeOtp(identifier, code) {
  // AUTH_CONTRACT_ALLOWLIST: legacy OTP endpoint retained for storage change step-up verification.
  const response = await api.post('/auth/verify-otp', {
    identifier,
    code,
    purpose: 'storage_change',
  });
  return response.data;
}

export async function changeStorageProvider(payload) {
  const response = await api.post('/firm/storage/change', payload);
  return response.data;
}

export async function exportFirmStorage() {
  const response = await api.get('/storage/export');
  return response.data;
}

export async function listStorageExports(limit = 10) {
  const response = await api.get('/storage/exports', { params: { limit } });
  return response.data;
}

export async function getStorageUsage() {
  const response = await api.get('/storage/usage');
  return response.data;
}

export async function getStorageDataMap() {
  const response = await api.get('/storage/data-map');
  return response.data;
}
