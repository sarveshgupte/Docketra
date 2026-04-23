import api from './api';

export async function getStorageConfiguration() {
  const response = await api.get('/storage/configuration');
  return response.data;
}

export async function connectGoogleDrive() {
  window.location.assign('/api/storage/google/connect');
}

export async function testStorageConnection() {
  const response = await api.post('/storage/test-connection');
  return response.data;
}

export async function sendStorageChangeOtp(email) {
  const response = await api.post('/auth/send-otp', {
    email,
    purpose: 'storage_change',
  });
  return response.data;
}

export async function verifyStorageChangeOtp(identifier, code) {
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
  const response = await api.post('/storage/export');
  return response.data;
}

export async function listStorageExports(limit = 10) {
  const response = await api.get('/storage/exports', { params: { limit } });
  return response.data;
}
