/**
 * Repository Layer Index
 * 
 * Centralized export of all firm-scoped repositories.
 * Controllers and services should import from here.
 */

const CaseRepository = require('./CaseRepository');
const ClientRepository = require('./ClientRepository');
const categoryRepository = require('./category.repository');
const TaskRepository = require('./TaskRepository');
const UserRepository = require('./UserRepository');
const AttachmentRepository = require('./AttachmentRepository');

module.exports = {
  CaseRepository,
  ClientRepository,
  categoryRepository,
  TaskRepository,
  UserRepository,
  AttachmentRepository,
};
