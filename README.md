# Docketra - Task & Case Management System

A backend-first task and case management web application designed for small consultancies. Built with Node.js, Express, and MongoDB.

> **📚 Documentation**: For a complete guide to all documentation in this repository, see [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

## 🎯 Overview

Docketra is an internal task and case management system that prioritizes:
- **Backend-first development**: Complete, robust API before frontend
- **Strong data integrity**: Mongoose schemas with validation
- **Comprehensive audit trail**: Automatic tracking of all changes
- **Simple, clear architecture**: Easy to understand and maintain
- **Productivity-focused**: RESTful API design for rapid integration

## 📁 Project Structure

```
docketra/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # MongoDB connection setup
│   │   └── config.js    # Application configuration
│   ├── models/          # Mongoose data models
│   │   ├── User.js      # User model with audit fields
│   │   ├── Task.js      # Task model with status tracking
│   │   └── Case.js      # Case model with relationships
│   ├── controllers/     # Business logic
│   │   ├── userController.js
│   │   ├── taskController.js
│   │   └── caseController.js
│   ├── routes/          # API routes
│   │   ├── users.js
│   │   ├── tasks.js
│   │   └── cases.js
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.js   # Centralized error handling
│   │   ├── requestLogger.js  # Request logging for audit
│   │   └── notFound.js       # 404 handler
│   └── server.js        # Main application entry point
├── .env.example         # Environment variables template
├── .gitignore          
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd docketra
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/docketra
   APP_NAME=Docketra
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo service mongod start
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Initialize admin user**
   ```bash
   node src/scripts/seedAdmin.js
   ```
   
   This creates the default admin account:
   - **xID**: `X000001`
   - **Password**: `ChangeMe@123`
   
   ⚠️ **IMPORTANT**: Change the default password immediately after first login!

6. **Run the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Verify the server is running**
   ```bash
   curl http://localhost:3000/health
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

The API uses xID-based authentication. To access protected endpoints:

1. Login to get authenticated:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "xID": "X000001",
       "password": "ChangeMe@123"
     }'
   ```

2. Use the returned user data for subsequent requests. Protected endpoints require the `x-user-id` header:
   ```bash
   curl http://localhost:3000/api/users \
     -H "x-user-id: X000001"
   ```

### Endpoints Overview

#### Authentication
- `POST /api/auth/login` - Login with xID and password
- `POST /api/auth/logout` - Logout (requires authentication)
- `POST /api/auth/change-password` - Change password (requires authentication)
- `GET /api/auth/profile` - Get user profile (requires authentication)
- `PUT /api/auth/profile` - Update user profile (requires authentication)

#### Users
- `GET /api/users` - List all users (with pagination and filters)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (soft delete)

#### Tasks
- `GET /api/tasks` - List all tasks (with filters)
- `GET /api/tasks/:id` - Get task by ID (with audit history)
- `GET /api/tasks/stats` - Get task statistics
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

#### Cases
- `GET /api/cases` - List all cases (with filters)
- `GET /api/cases/:id` - Get case by ID (with related tasks)
- `GET /api/cases/stats` - Get case statistics
- `POST /api/cases` - Create new case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case (only if no tasks)
- `POST /api/cases/:id/notes` - Add note to case

### Example Requests

#### Create a User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "consultant"
  }'
```

#### Create a Case
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "CASE-001",
    "title": "Client Website Redesign",
    "description": "Complete redesign of client website",
    "priority": "high",
    "client": {
      "name": "Acme Corp",
      "email": "contact@acme.com"
    },
    "createdBy": "USER_ID_HERE"
  }'
```

#### Create a Task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design homepage mockup",
    "description": "Create initial homepage design mockup",
    "priority": "high",
    "status": "pending",
    "assignedTo": "USER_ID_HERE",
    "case": "CASE_ID_HERE",
    "dueDate": "2024-02-01",
    "createdBy": "USER_ID_HERE"
  }'
```

#### Query Tasks
```bash
# Get all pending tasks
curl "http://localhost:3000/api/tasks?status=pending"

# Get high priority tasks assigned to a user
curl "http://localhost:3000/api/tasks?priority=high&assignedTo=USER_ID"

# Get tasks for a specific case
curl "http://localhost:3000/api/tasks?case=CASE_ID"
```

## 🗄️ Data Models

### User Model
- **Fields**: xID (immutable), name (immutable), email, role (Admin/Employee), allowedCategories, isActive
- **Authentication**: xID-based with bcrypt password hashing
- **Security**: Password expiry (60 days), password history (last 5), forced password change on first login
- **Format**: xID follows pattern X123456 (X followed by 6 digits)
- **Audit**: createdAt, passwordLastChangedAt, passwordExpiresAt
- **Validation**: xID format, email format, required fields

### Task Model
- **Fields**: title, description, status, priority, assignedTo, case, dueDate, estimatedHours, actualHours
- **Status**: pending, in_progress, review, completed, blocked, cancelled
- **Priority**: low, medium, high, urgent
- **Audit**: createdBy, updatedBy, statusHistory, timestamps
- **Features**: Automatic status history tracking, completion timestamp

### Case Model
- **Fields**: caseNumber (unique), title, description, status, priority, client info, assignedTeam, leadConsultant
- **Status**: open, active, on_hold, closed, archived
- **Features**: Notes system, status history, task relationships, budget tracking
- **Audit**: createdBy, updatedBy, statusHistory, timestamps
- **Validation**: Cannot delete cases with active tasks

## 🔐 Data Integrity & Audit Trail

### Automatic Tracking
- All models include `createdAt` and `updatedAt` timestamps
- User actions tracked via `createdBy` and `updatedBy` fields
- Status changes logged with timestamp and user in `statusHistory`

### Request Logging
- All API requests logged with timestamp, method, URL, and IP
- Request bodies logged (excluding sensitive data)

### Data Validation
- Mongoose schema validation on all fields
- Email format validation
- Required field validation
- Numeric constraints (no negative hours/budgets)
- String length limits

## 🎨 Design Decisions

### Backend-First Approach
- Complete API built before frontend
- Focus on data integrity and business logic
- RESTful design for easy frontend integration

### MongoDB with Mongoose
- Schema validation for data integrity
- Flexible document structure for evolving requirements
- Built-in audit trail support with timestamps
- Efficient querying with indexes

### Simple Architecture
- Clear separation of concerns (MVC pattern)
- No over-engineering - standard Express patterns
- Easy to understand and maintain
- Scalable structure for future growth

### Audit Trail Implementation
- Automatic timestamp generation
- Status history tracking on state changes
- User tracking on all modifications
- Request logging for security

## 🔧 Development

### Running in Development Mode
```bash
npm run dev
```
Uses nodemon for automatic server restart on file changes.

### Project Dependencies
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **dotenv**: Environment variable management
- **cors**: Cross-origin resource sharing
- **nodemon**: Development auto-restart (dev dependency)

## 📝 Future Enhancements

- [x] Authentication & authorization (xID-based)
- [x] React frontend
- [ ] File attachments for cases/tasks
- [ ] Email notifications
- [ ] Time tracking integration
- [ ] Reporting and analytics dashboard
- [ ] API rate limiting
- [ ] Comprehensive test suite

## 🤝 Contributing

This is an internal project for a small consultancy. For questions or suggestions, please contact the development team.

## 📄 License

ISC

