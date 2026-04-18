const Case = require('../models/Case.model');
const { DocketLifecycle } = require('../domain/docketLifecycle');
const { findClientByEmailOrPhone, createClient } = require('./client.service');
const { mapServiceToRouting } = require('./routing.service');
const { logDocketEvent } = require('./docketAudit.service');

function validateFormSubmission(formData = {}) {
  const name = String(formData.name || '').trim();
  const email = String(formData.email || '').trim().toLowerCase();
  const phone = String(formData.phone || '').trim();
  const service = String(formData.service || '').trim();
  const normalizedService = service.toLowerCase();

  if (!name || (!email && !phone) || !service) {
    throw new Error('Invalid form submission');
  }

  return {
    name,
    email,
    phone,
    service,
    normalizedService,
    message: String(formData.message || '').trim(),
  };
}

async function createDocket({
  firmId,
  clientId,
  title,
  description,
  category,
  subcategory,
  categoryId,
  subcategoryId,
  workbasketId,
}) {
  const docket = await Case.create({
    firmId: String(firmId),
    clientId,
    title,
    description,
    category,
    subcategory,
    caseCategory: category,
    caseSubCategory: subcategory,
    categoryId,
    subcategoryId,
    status: 'OPEN',
    state: 'IN_WB',
    lifecycle: DocketLifecycle.ACTIVE,
    queueType: 'GLOBAL',
    ownerTeamId: workbasketId,
    routedToTeamId: workbasketId,
    workbasketId,
    createdByXID: 'SYSTEM',
    createdBy: 'system@docketra.local',
  });

  return docket;
}

async function handleFormSubmission({
  firmId,
  formData,
  source = 'CMS_FORM',
}) {
  const { name, email, phone, service, normalizedService, message } = validateFormSubmission(formData);

  let client = await findClientByEmailOrPhone({ firmId, email, phone });

  if (!client) {
    client = await createClient({
      firmId,
      name,
      email,
      phone,
      createdByXid: 'SYSTEM',
    });
  }

  const {
    category,
    subcategory,
    categoryId,
    subcategoryId,
    workbasketId,
  } = await mapServiceToRouting({ firmId, service: normalizedService });

  const docket = await createDocket({
    firmId,
    clientId: client.clientId,
    title: `${service} request - ${name}`,
    description: message || '',
    category,
    subcategory,
    categoryId,
    subcategoryId,
    workbasketId,
  });


  await logDocketEvent({
    docketId: docket.caseId,
    firmId,
    event: 'DOCKET_CREATED',
    userId: 'SYSTEM',
    userRole: 'SYSTEM',
    metadata: {
      source,
      service,
      clientId: client.clientId,
    },
  });

  await logDocketEvent({
    docketId: docket.caseId,
    firmId,
    event: 'LEAD_CREATED',
    userId: 'SYSTEM',
    userRole: 'SYSTEM',
    metadata: {
      source: 'CMS',
      email: email || null,
      phone: phone || null,
      service,
    },
  });

  return { client, docket };
}

module.exports = {
  handleFormSubmission,
  validateFormSubmission,
  createDocket,
};
