import api from './api';

export async function getAiConfiguration() {
  const response = await api.get('/ai/configuration');
  return response.data?.configuration || null;
}

export async function updateAiConfiguration(payload) {
  const response = await api.put('/ai/configuration', payload);
  return response.data;
}

export async function testAiConfiguration() {
  const response = await api.post('/ai/test-configuration');
  return response.data;
}
