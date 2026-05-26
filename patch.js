const fs = require('fs');
const file = 'src/automations/bulkUpload.handlers.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `  const { category, subcategory } = categoryBundle;

  for (const createdClient of createdClients) {
    try {
      const idempotencyKey = \`automation:bulk-upload:default-docket:\${user.firmId}:\${createdClient.clientId}\`;
      const existingCase = await Case.findOne({ firmId: user.firmId, idempotencyKey }).select('_id').lean();
      if (existingCase) continue;

      const createdAt = new Date();
      const fallbackDueDate = slaService.calculateFallbackDueDateFromDays(
        createdAt,
        Math.max(0, Number(subcategory.defaultSlaDays || category.defaultSlaDays || 3)),
      );

      const dueDate = await slaService.calculateSlaDueDate({
        firmId: user.firmId,
        category: category.name,
        subcategory: subcategory.name,
        workbasketId: subcategory.workbasketId || null,
        createdAt,
      }) || fallbackDueDate;

      await Case.create({`,
  `  const { category, subcategory } = categoryBundle;

  const idempotencyKeys = createdClients.map(c => \`automation:bulk-upload:default-docket:\${user.firmId}:\${c.clientId}\`);
  const existingCases = await Case.find({ firmId: user.firmId, idempotencyKey: { $in: idempotencyKeys } }).select('idempotencyKey').lean();
  const existingKeys = new Set(existingCases.map(c => c.idempotencyKey));

  const createdAt = new Date();
  const fallbackDueDate = slaService.calculateFallbackDueDateFromDays(
    createdAt,
    Math.max(0, Number(subcategory.defaultSlaDays || category.defaultSlaDays || 3)),
  );
  const dueDate = await slaService.calculateSlaDueDate({
    firmId: user.firmId,
    category: category.name,
    subcategory: subcategory.name,
    workbasketId: subcategory.workbasketId || null,
    createdAt,
  }) || fallbackDueDate;

  for (const createdClient of createdClients) {
    try {
      const idempotencyKey = \`automation:bulk-upload:default-docket:\${user.firmId}:\${createdClient.clientId}\`;
      if (existingKeys.has(idempotencyKey)) continue;

      await Case.create({`
);

fs.writeFileSync(file, code);
