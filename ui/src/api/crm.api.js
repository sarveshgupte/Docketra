import { request } from './apiClient';

export const crmApi = {
  listClients: (params) => request((http) => http.get('/crm-clients', { params }), 'Failed to load CRM clients'),
  getClientById: (id) => request((http) => http.get(`/crm-clients/${id}`), 'Failed to load CRM client details'),
  createClient: (data) => request((http) => http.post('/crm-clients', data), 'Failed to create CRM client'),

  listLeads: (params) => request((http) => http.get('/leads', { params }), 'Failed to load leads'),
  createLead: (data) => request((http) => http.post('/leads', data), 'Failed to create lead'),
  updateLeadStatus: (id, status) => request((http) => http.patch(`/leads/${id}/status`, { status }), 'Failed to update lead status'),

  listDeals: (params) => request((http) => http.get('/deals', { params }), 'Failed to load deals'),
  createDeal: (data) => request((http) => http.post('/deals', data), 'Failed to create deal'),
  updateDealStage: (id, stage) => request((http) => http.patch(`/deals/${id}/stage`, { stage }), 'Failed to update deal stage'),

  listInvoices: (params) => request((http) => http.get('/invoices', { params }), 'Failed to load invoices'),
  createInvoice: (data) => request((http) => http.post('/invoices', data), 'Failed to create invoice'),
  markInvoicePaid: (id) => request((http) => http.patch(`/invoices/${id}/paid`), 'Failed to mark invoice as paid'),
};
