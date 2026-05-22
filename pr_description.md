### Summary
- Adds cloud-first docket narrative references and read hydration behavior.
- Keeps backward compatibility for existing/legacy Mongo-based narrative fields.

### Scope clarification
This PR adds cloud-first docket narrative refs/hydration. It does not yet remove legacy Mongo narrative persistence on create.

### Testing
✅ node tests/dataResidency.mongoSchemaGuard.test.js
✅ node tests/caseCreate.checklistSnapshot.test.js
✅ node tests/caseCreate.deadlineRule.test.js
✅ node tests/strictFirmOwnedStorage.enforcement.test.js
✅ node tests/docketNarrative.cloudFirstStorage.test.js
