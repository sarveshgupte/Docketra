import api from './api';

export async function getAiConfigurationStatus() {
  const response = await api.get('/ai/status');
  return response.data;
}

export async function saveAiConfiguration(payload) {
  const response = await api.post('/ai/config', payload);
  return response.data;
}

export async function disconnectAiConfiguration() {
  const response = await api.delete('/ai/config');
  return response.data;
}
