# API Testing Guide

This guide provides practical examples for testing the Docketra API using curl.

## Prerequisites

- Server running on http://localhost:3000
- MongoDB running and connected
- curl installed

## Quick Start Examples

### 1. Check Server Health

```bash
curl http://localhost:3000/health
```

### 2. View API Documentation

```bash
curl http://localhost:3000/api
```

## User Management

### Create a User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "consultant"
  }'
```

### List All Users

```bash
curl http://localhost:3000/api/users
```

### Get User by ID

```bash
curl http://localhost:3000/api/users/USER_ID
```

### Update User

```bash
curl -X PUT http://localhost:3000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "role": "manager"
  }'
```

### Filter Users by Role

```bash
curl "http://localhost:3000/api/users?role=consultant"
```

## Case Management

### Create a Case

```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "CASE-2024-001",
    "title": "Website Redesign Project",
    "description": "Complete website redesign for client",
    "priority": "high",
    "status": "active",
    "client": {
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "+1-555-0100",
      "organization": "Acme Corp"
    },
    "leadConsultant": "LEAD_USER_ID",
    "assignedTeam": ["USER_ID_1", "USER_ID_2"],
    "estimatedBudget": 50000,
    "targetCloseDate": "2024-12-31",
    "createdBy": "USER_ID"
  }'
```

### List All Cases

```bash
curl http://localhost:3000/api/cases
```

### Get Case with Tasks

```bash
curl http://localhost:3000/api/cases/CASE_ID
```

### Update Case

```bash
curl -X PUT http://localhost:3000/api/cases/CASE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "on_hold",
    "updatedBy": "USER_ID"
  }'
```

### Filter Cases by Status

```bash
curl "http://localhost:3000/api/cases?status=active"
```

### Filter Cases by Priority

```bash
curl "http://localhost:3000/api/cases?priority=high"
```

### Add Note to Case

```bash
curl -X POST http://localhost:3000/api/cases/CASE_ID/notes \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Client meeting scheduled for next week",
    "createdBy": "USER_ID"
  }'
```

### Get Case Statistics

```bash
curl http://localhost:3000/api/cases/stats
```

## Task Management

### Create a Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design homepage mockup",
    "description": "Create initial homepage design with modern UI",
    "priority": "high",
    "status": "pending",
    "assignedTo": "USER_ID",
    "case": "CASE_ID",
    "dueDate": "2024-02-15",
    "estimatedHours": 16,
    "tags": ["design", "homepage"],
    "createdBy": "USER_ID"
  }'
```

### List All Tasks

```bash
curl http://localhost:3000/api/tasks
```

### Get Task by ID (with Audit History)

```bash
curl http://localhost:3000/api/tasks/TASK_ID
```

### Update Task Status

```bash
curl -X PUT http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "updatedBy": "USER_ID"
  }'
```

### Complete a Task

```bash
curl -X PUT http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "actualHours": 14,
    "updatedBy": "USER_ID"
  }'
```

### Filter Tasks by Status

```bash
curl "http://localhost:3000/api/tasks?status=pending"
```

### Filter Tasks by Priority

```bash
curl "http://localhost:3000/api/tasks?priority=high"
```

### Filter Tasks by Assignee

```bash
curl "http://localhost:3000/api/tasks?assignedTo=USER_ID"
```

### Filter Tasks by Case

```bash
curl "http://localhost:3000/api/tasks?case=CASE_ID"
```

### Get Task Statistics

```bash
curl http://localhost:3000/api/tasks/stats
```

## Pagination

All list endpoints support pagination:

```bash
# Get page 2 with 10 results per page
curl "http://localhost:3000/api/tasks?page=2&limit=10"
```

## Combining Filters

You can combine multiple filters:

```bash
# Get high priority, pending tasks assigned to a specific user
curl "http://localhost:3000/api/tasks?status=pending&priority=high&assignedTo=USER_ID"
```

## Response Format

All responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### List Response with Pagination
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

## Audit Trail

All models automatically track:
- `createdAt` - When the record was created
- `updatedAt` - When the record was last updated
- `createdBy` - User who created the record
- `updatedBy` - User who last updated the record

Tasks and Cases also track:
- `statusHistory` - Array of all status changes with timestamp and user

## Tips

1. **Save IDs**: When you create users, save their IDs to use in subsequent requests
2. **Use jq**: For better JSON formatting, pipe curl output through jq:
   ```bash
   curl http://localhost:3000/api/users | jq
   ```
3. **Pretty Print**: Or use Python's json.tool:
   ```bash
   curl http://localhost:3000/api/users | python3 -m json.tool
   ```
4. **View Logs**: Check server logs to see request logging and any errors

## Workflow Example

Here's a complete workflow:

```bash
# 1. Create users
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"consultant"}'

curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@example.com","role":"manager"}'

# 2. Create a case (replace USER_IDs)
curl -X POST http://localhost:3000/api/cases -H "Content-Type: application/json" \
  -d '{
    "caseNumber":"CASE-2024-001",
    "title":"Client Project",
    "priority":"high",
    "client":{"name":"Acme Corp","email":"contact@acme.com"},
    "leadConsultant":"MANAGER_ID",
    "createdBy":"MANAGER_ID"
  }'

# 3. Create tasks (replace IDs)
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" \
  -d '{
    "title":"Initial Design",
    "priority":"high",
    "status":"pending",
    "assignedTo":"CONSULTANT_ID",
    "case":"CASE_ID",
    "createdBy":"MANAGER_ID"
  }'

# 4. Update task status
curl -X PUT http://localhost:3000/api/tasks/TASK_ID -H "Content-Type: application/json" \
  -d '{"status":"in_progress","updatedBy":"CONSULTANT_ID"}'

# 5. View case with all tasks
curl http://localhost:3000/api/cases/CASE_ID

# 6. Add note to case
curl -X POST http://localhost:3000/api/cases/CASE_ID/notes -H "Content-Type: application/json" \
  -d '{"content":"Project kickoff completed","createdBy":"MANAGER_ID"}'
```
