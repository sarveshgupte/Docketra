const express = require('express');
const { createCrmClient, listCrmClients, getCrmClientById } = require('../controllers/crmClient.controller');

const router = express.Router();

router.post('/', createCrmClient);
router.get('/', listCrmClients);
router.get('/:id', getCrmClientById);

module.exports = router;
