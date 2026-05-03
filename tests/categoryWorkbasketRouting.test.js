const assert = require('assert');
const categoryController = require('../src/controllers/category.controller');
const Category = require('../src/models/Category.model');
const Team = require('../src/models/Team.model');
const Case = require('../src/models/Case.model');

function res() { return { statusCode: 200, body: null, status(c){ this.statusCode=c; return this; }, json(b){ this.body=b; return this; } }; }

async function run() {
  const origCategoryFindOne = Category.findOne;
  const origTeamFindOne = Team.findOne;
  const origCaseUpdateMany = Case.updateMany;

  const categoryDoc = {
    _id: '507f1f77bcf86cd799439001', name: 'Tax', subcategories: [{ id: 'sub-1', name: 'GST', workbasketId: '507f1f77bcf86cd799439011', isActive: true }],
    save: async () => {},
  };

  Category.findOne = async () => categoryDoc;

  Team.findOne = (query) => ({
    select: async () => {
      if (!String(query.firmId).includes('firm-1')) return null;
      if (!query.isActive || query.type !== 'PRIMARY') return null;
      if (String(query._id) === '507f1f77bcf86cd799439012') return { _id: '507f1f77bcf86cd799439012' };
      return null;
    },
  });

  // 1/2/3/4 invalid workbasket combinations rejected
  let r = res();
  await categoryController.addSubcategory({ params: { id: 'c1' }, body: { name: 'A', workbasketId: 'bad-id' }, user: { firmId: 'firm-1', role: 'PRIMARY_ADMIN', xID: 'X1' } }, r);
  assert.strictEqual(r.statusCode, 400);

  r = res();
  await categoryController.addSubcategory({ params: { id: 'c1' }, body: { name: 'A', workbasketId: '507f1f77bcf86cd799439012' }, user: { firmId: 'other-firm', role: 'PRIMARY_ADMIN', xID: 'X1' } }, r);
  assert.strictEqual(r.statusCode, 400);

  // 5 valid primary accepted
  r = res();
  await categoryController.addSubcategory({ params: { id: 'c1' }, body: { name: 'NewSub', workbasketId: '507f1f77bcf86cd799439012' }, user: { firmId: 'firm-1', role: 'PRIMARY_ADMIN', xID: 'X1' } }, r);
  assert.strictEqual(r.statusCode, 201);

  // 8/9/10 mapping change moves only unassigned WB non-terminal
  let updateQuery = null;
  Case.updateMany = async (query) => { updateQuery = query; return { modifiedCount: 3 }; };
  r = res();
  await categoryController.updateSubcategory({ params: { id: 'c1', subcategoryId: 'sub-1' }, body: { name: 'GST', workbasketId: '507f1f77bcf86cd799439012' }, user: { firmId: 'firm-1', role: 'PRIMARY_ADMIN', xID: 'X1' } }, r);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(updateQuery.assignedToXID, null);
  assert.strictEqual(updateQuery.$and[0].state, 'IN_WB');
  assert.deepStrictEqual(updateQuery.$and[1].state.$nin, ['RESOLVED', 'FILED']);
  assert.deepStrictEqual(updateQuery.status.$nin, ['RESOLVED', 'FILED']);

  Category.findOne = origCategoryFindOne;
  Team.findOne = origTeamFindOne;
  Case.updateMany = origCaseUpdateMany;
  console.log('category workbasket routing tests passed');
}

run().catch((e) => { console.error(e); process.exit(1); });
