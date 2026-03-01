# Multi-tenant Index Migration (`add_multi_tenant_indexes`)

## Detected query patterns (from code)

1. **Employee workbasket**
   - `Case.find({ firmId, assignedToXID: user.xID, status: OPEN }).sort({ createdAt: -1 })`
2. **Status dashboards / admin views**
   - `Case.find({ firmId, status }).sort({ createdAt: -1 })`
3. **Pending/SLA-style due ordering**
   - `Case.find({ firmId, status }).sort({ pendingUntil: 1 })` and due-date based metrics filtered by `firmId`
4. **History/audit lookup**
   - `CaseHistory.find({ caseId, firmId }).sort({ timestamp: -1 })`

All tenant-bound access patterns are firm-scoped (`firmId`), so compound indexes are firm-first.

---

## Migration file

- `scripts/migrations/add_multi_tenant_indexes.js`

Run:

```bash
node scripts/migrations/add_multi_tenant_indexes.js up
```

Rollback:

```bash
node scripts/migrations/add_multi_tenant_indexes.js down
```

---

## SQL-equivalent index statements (PostgreSQL reference)

```sql
-- CASES
CREATE INDEX IF NOT EXISTS idx_cases_tenant_status
ON cases (tenantId, status);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_assigned
ON cases (tenantId, assignedTo);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_due
ON cases (tenantId, dueDate);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_created
ON cases (tenantId, createdAt);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_status_due
ON cases (tenantId, status, dueDate);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_assigned_status
ON cases (tenantId, assignedTo, status);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_status_created_desc
ON cases (tenantId, status, createdAt DESC);

-- Optional active-only partial index
CREATE INDEX IF NOT EXISTS idx_cases_active
ON cases (tenantId, dueDate)
WHERE status NOT IN ('RESOLVED', 'CLOSED');

-- AUDIT (entity history)
CREATE INDEX IF NOT EXISTS idx_audit_tenant_entity_created_desc
ON case_audits (tenantId, entityId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created_desc
ON case_audits (tenantId, createdAt DESC);
```

---

## MongoDB indexes actually applied by migration

```js
// cases
{ firmId: 1, status: 1 }                                // idx_cases_tenant_status
{ firmId: 1, assignedToXID: 1 }                         // idx_cases_tenant_assigned
{ firmId: 1, dueDate: 1 }                               // idx_cases_tenant_due
{ firmId: 1, createdAt: 1 }                             // idx_cases_tenant_created
{ firmId: 1, status: 1, dueDate: 1 }                    // idx_cases_tenant_status_due
{ firmId: 1, assignedToXID: 1, status: 1 }              // idx_cases_tenant_assigned_status
{ firmId: 1, status: 1, createdAt: -1 }                 // idx_cases_tenant_status_created_desc
{ firmId: 1, dueDate: 1 }, partial(status NOT IN [RESOLVED, CLOSED])  // idx_cases_active_due

// casehistories (audit/history stream)
{ firmId: 1, caseId: 1, timestamp: -1 }                 // idx_case_history_tenant_entity_created_desc
{ firmId: 1, timestamp: -1 }                            // idx_case_history_tenant_created_desc
```

---

## Why each index exists

- `firmId + status`: tenant-safe status filters.
- `firmId + assignedToXID`: tenant-safe assignee filters.
- `firmId + dueDate`: due-date range/sort workloads.
- `firmId + createdAt`: tenant-scoped creation-time dashboards.
- `firmId + status + dueDate`: status filter + due-date ordering.
- `firmId + assignedToXID + status`: employee worklist filters.
- `firmId + status + createdAt DESC`: admin/dashboard recency lists.
- Partial `firmId + dueDate WHERE status NOT IN (RESOLVED, CLOSED)`: hot-path active SLA scans using canonical status values.
- `firmId + caseId + timestamp DESC`: per-case audit trail retrieval.
- `firmId + timestamp DESC`: tenant-wide audit feed by time.

---

## EXPLAIN validation checklist

For each critical query, validate planner behavior in production-like data volumes.

1. Confirm **index scan** on firm-first compound index.
2. Confirm no collection/table full scan for high-cardinality tenant data.
3. Confirm sort is covered (no large in-memory sort).
4. Validate latency under realistic tenant cardinality (50k+ cases/tenant).
5. Re-check after stats refresh and after status distribution changes.

**Postgres examples**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM cases
WHERE tenantId = $1 AND status = $2
ORDER BY createdAt DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM cases
WHERE tenantId = $1 AND assignedTo = $2 AND status IN ('OPEN','PENDED')
ORDER BY createdAt DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM case_audits
WHERE tenantId = $1 AND entityId = $2
ORDER BY createdAt DESC
LIMIT 200;
```

**MongoDB examples**

```javascript
db.cases.find({ firmId, status }).sort({ createdAt: -1 }).limit(50).explain('executionStats');
db.cases.find({ firmId, assignedToXID, status: 'OPEN' }).sort({ createdAt: -1 }).limit(50).explain('executionStats');
db.casehistories.find({ firmId, caseId }).sort({ timestamp: -1 }).limit(200).explain('executionStats');
```

---

## Rollback statements

### SQL rollback

```sql
DROP INDEX IF EXISTS idx_cases_tenant_status;
DROP INDEX IF EXISTS idx_cases_tenant_assigned;
DROP INDEX IF EXISTS idx_cases_tenant_due;
DROP INDEX IF EXISTS idx_cases_tenant_created;
DROP INDEX IF EXISTS idx_cases_tenant_status_due;
DROP INDEX IF EXISTS idx_cases_tenant_assigned_status;
DROP INDEX IF EXISTS idx_cases_tenant_status_created_desc;
DROP INDEX IF EXISTS idx_cases_active;
DROP INDEX IF EXISTS idx_audit_tenant_entity_created_desc;
DROP INDEX IF EXISTS idx_audit_tenant_created_desc;
```

### Mongo rollback

```bash
node scripts/migrations/add_multi_tenant_indexes.js down
```
