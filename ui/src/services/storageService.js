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
