const { globalWorklist, categoryWorklist, employeeWorklist } = require('./search.controller');
const { moveDocket } = require('./docketWorkflow.controller');

module.exports = {
  globalWorklist,
  categoryWorklist,
  employeeWorklist,
  moveDocket,
};
