# Caseflow Architecture Document

## Overview

Caseflow is a backend-first task and case management system designed for small consultancies. This document explains the architectural decisions and design patterns used.

## Architecture Principles

### 1. Backend-First Approach
- **Complete API before UI**: Focus on robust data models and business logic
- **API-first design**: RESTful endpoints that can serve multiple frontends
- **Clear contracts**: Well-defined request/response formats

### 2. Productivity Focus
- **Conventional structure**: Standard Express.js patterns everyone understands
- **Minimal boilerplate**: No unnecessary abstractions or frameworks
- **Clear separation**: Models, Controllers, Routes, Middleware
- **Self-documenting code**: Meaningful names and comments where needed

### 3. Data Integrity & Audit Trail
- **Schema validation**: Mongoose schemas enforce data rules at the database level
- **Automatic tracking**: Timestamps on all records (createdAt, updatedAt)
- **User attribution**: Who created and modified each record
- **Status history**: Complete audit trail of state changes
- **Request logging**: All API calls logged with timestamp and user

### 4. Simplicity Over Complexity
- **No over-engineering**: Using proven patterns, not the latest trend
- **Standard tools**: Express, Mongoose, no complex frameworks
- **Easy to understand**: New developers can onboard quickly
- **Easy to maintain**: Clear code structure and documentation

## Technology Stack

### Core Technologies
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework - lightweight, flexible, widely understood
- **MongoDB**: Document database - flexible schema, easy to evolve
- **Mongoose**: ODM - schema validation, middleware, relationships

### Why These Choices?

**Express vs. Alternatives (NestJS, Fastify, etc.)**
- Most widely known and documented
- Largest ecosystem of middleware
- Simple, unopinionated - easier to customize
- Perfect for our "no over-engineering" principle

**MongoDB vs. SQL Databases**
- Flexible schema - requirements evolve in consultancies
- Easy to add fields without migrations
- Natural fit for JavaScript/JSON
- Built-in support for nested documents (client info, notes)

**Mongoose vs. Native Driver**
- Schema validation out of the box
- Middleware for audit trail automation
- Population for relationships
- Better TypeScript support (future)

## Project Structure

```
src/
├── config/           # Configuration and database connection
├── models/           # Mongoose schemas (data layer)
├── controllers/      # Business logic (application layer)
├── routes/           # API endpoints (presentation layer)
├── middleware/       # Cross-cutting concerns
└── server.js         # Application entry point
```

### Why This Structure?

**MVC-inspired but adapted**:
- **Models**: Data structure and rules
- **Controllers**: Business logic, separated from routes
- **Routes**: URL mapping and basic validation
- **Middleware**: Authentication, logging, error handling

**Benefits**:
- Clear separation of concerns
- Easy to test each layer independently
- New developers know where to find code
- Scalable as the application grows

## Data Models

### User Model
```
User
├── name (string, required)
├── email (string, required, unique)
├── role (enum: admin, manager, consultant, client)
├── isActive (boolean) - soft delete support
└── Audit: createdBy, updatedBy, timestamps
```

**Design Decisions**:
- Email as unique identifier (before authentication)
- Role-based system (expandable for future RBAC)
- Soft delete (isActive) - never lose data
- Simple structure - can add authentication later

### Case Model
```
Case
├── caseNumber (string, unique) - business identifier
├── title, description
├── status (enum: open, active, on_hold, closed, archived)
├── priority (enum: low, medium, high, urgent)
├── client (embedded document)
│   ├── name, email, phone, organization
├── assignedTeam (array of User references)
├── leadConsultant (User reference)
├── dates: startDate, targetCloseDate, actualCloseDate
├── budget: estimatedBudget, actualCost
├── tags (array)
├── notes (embedded array with creator and timestamp)
├── statusHistory (embedded array)
└── Audit: createdBy, updatedBy, timestamps
```

**Design Decisions**:
- Business-friendly caseNumber (CASE-2024-001 vs ObjectId)
- Embedded client info - simpler than separate collection
- Status history for complete audit trail
- Notes embedded - fast access, always with case
- Both team and lead consultant - flexibility in assignment
- Budget tracking built-in - consultancies need this

### Task Model
```
Task
├── title, description
├── status (enum: pending, in_progress, review, completed, blocked, cancelled)
├── priority (enum: low, medium, high, urgent)
├── assignedTo (User reference)
├── case (Case reference) - optional, can be standalone
├── dates: dueDate, completedAt
├── hours: estimatedHours, actualHours
├── tags (array)
├── statusHistory (embedded array)
└── Audit: createdBy, updatedBy, timestamps
```

**Design Decisions**:
- Can belong to a case or be standalone
- Multiple status options for workflow flexibility
- Hour tracking for time management
- Status automatically tracked on changes
- CompletedAt set automatically when status changes to completed

## API Design

### RESTful Principles
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Resource-based URLs (/api/users, /api/cases, /api/tasks)
- Consistent response format
- Proper HTTP status codes

### Response Format
```json
{
  "success": true/false,
  "data": { ... },
  "message": "Optional message",
  "pagination": { ... }  // For list endpoints
}
```

**Why this format?**
- `success` flag makes it easy for clients to check
- Consistent structure across all endpoints
- Pagination metadata separate from data
- Error format matches success format

### Filtering and Pagination
- Query parameters for filtering (status, priority, assignedTo, etc.)
- Standard pagination (page, limit)
- Default limits to prevent large queries

### Population (Joins)
- Automatic population of related data
- User references always populated with name and email
- Reduces round trips for clients
- Balance between data completeness and performance

## Middleware Design

### Request Logger
- Logs all requests with timestamp and IP
- Logs request body for POST/PUT (audit trail)
- Excludes sensitive fields (password, token)
- Essential for debugging and security

### Error Handler
- Centralized error handling
- Mongoose-specific error handling
- Consistent error response format
- Stack traces in development only

### Not Found Handler
- 404 for undefined routes
- Helpful error messages

## Audit Trail Implementation

### Automatic Tracking
```javascript
// Timestamps (built-in Mongoose)
timestamps: true
→ createdAt, updatedAt

// User tracking (manual)
createdBy, updatedBy references

// Status history (middleware)
pre('save', async function() {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({...})
  }
})
```

### Why This Approach?
- Timestamps are free (Mongoose built-in)
- User tracking requires authentication (coming later)
- Status history automatic via middleware
- Zero overhead for developers
- Complete audit trail without extra code

## Data Integrity

### Mongoose Validation
```javascript
{
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/regex/, 'Please provide a valid email']
  }
}
```

### Benefits:
- Validation before database
- Custom error messages
- Type coercion (strings, dates)
- Unique constraints
- Min/max values

### Pre-save Middleware
- Status history tracking
- Completion timestamps
- Data transformations
- Business rule enforcement

## Indexes

Strategic indexes for performance:
- Unique indexes: email, caseNumber
- Query indexes: status, priority, assignedTo
- Compound indexes: status + priority, assignedTo + status
- No over-indexing (slows writes)

## Security Considerations

### Current State
- Input validation via Mongoose schemas
- Error messages don't leak sensitive info
- Request body logging excludes sensitive fields
- CORS enabled (configure for production)

### Future Additions
- Authentication (JWT)
- Authorization (role-based)
- Rate limiting
- Input sanitization
- API keys for external access

## Scalability Considerations

### Current Design Supports:
- Horizontal scaling (stateless API)
- Database replica sets
- Connection pooling (Mongoose default)
- Pagination prevents large queries

### Future Optimizations:
- Caching layer (Redis)
- Read replicas for reporting
- Aggregation pipeline for analytics
- Background jobs for heavy operations

## Testing Strategy (Future)

### Unit Tests
- Model validation
- Controller logic
- Utility functions

### Integration Tests
- API endpoints
- Database operations
- Middleware chain

### Tools to Consider
- Jest/Mocha for test runner
- Supertest for API testing
- MongoDB Memory Server for test database

## Deployment Considerations

### Environment Variables
- All configuration in .env
- Different configs for dev/staging/prod
- No secrets in code

### Process Management
- PM2 for production
- Clustering for multiple cores
- Auto-restart on crash
- Log management

### Database
- MongoDB Atlas for managed hosting
- Or self-hosted with replica sets
- Regular backups
- Index monitoring

## Future Enhancements

### Phase 2: Authentication
- JWT-based authentication
- Password hashing (bcrypt)
- Refresh tokens
- Role-based access control

### Phase 3: Frontend
- React SPA
- State management (Context or Redux)
- Real-time updates (Socket.io)
- Dashboard with analytics

### Phase 4: Advanced Features
- File attachments
- Email notifications
- Time tracking integration
- Reporting and analytics
- Webhooks for integrations

## Lessons Learned

### What Worked Well
- Backend-first approach - solid foundation
- Simple structure - easy to navigate
- Audit trail design - complete history
- Mongoose validation - caught errors early

### What to Watch
- Populate performance - monitor as data grows
- Schema flexibility - don't change too often
- User tracking - needs authentication
- Complex queries - may need aggregation

## Conclusion

This architecture prioritizes:
1. **Clarity** over cleverness
2. **Productivity** over perfection
3. **Maintainability** over novelty
4. **Data integrity** over shortcuts

It's designed for a small consultancy where:
- Requirements evolve
- Developers come and go
- Business value matters more than technical showcasing
- The system must be understood and maintained long-term

The foundation is solid, the structure is clear, and the path forward is obvious.
