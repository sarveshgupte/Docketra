# UI Testing & Deployment Guide

## Overview

This guide covers testing and deploying the Docketra Neomorphic UI.

## Prerequisites

### Required Services
1. **MongoDB** - Backend database
2. **Node.js 14+** - For both backend and UI
3. **Backend API** - Running on port 3000

## Local Development Setup

### Step 1: Start MongoDB

**Option A: Using Docker**
```bash
docker run -d \
  --name docketra-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

**Option B: Using Local MongoDB**
```bash
sudo systemctl start mongod
# or
brew services start mongodb-community
```

### Step 2: Configure Backend

1. Create backend `.env` file:
```bash
cd /path/to/docketra
cp .env.example .env
```

2. Edit `.env`:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/docketra
APP_NAME=Docketra
JWT_SECRET=your_secure_secret_here_change_in_production
```

### Step 3: Start Backend

```bash
cd /path/to/docketra
npm install
npm run dev
```

Verify backend is running:
```bash
curl http://localhost:3000/health
```

### Step 4: Configure UI

1. Create UI `.env` file:
```bash
cd /path/to/docketra/ui
cp .env.example .env
```

2. Edit `.env` (optional, default is correct):
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### Step 5: Start UI Development Server

```bash
cd /path/to/docketra/ui
npm install
npm run dev
```

The UI will be available at: **http://localhost:5173**

## Testing the UI

### 1. Authentication Testing

**Test Login:**
- Navigate to http://localhost:5173
- Should redirect to `/login`
- Enter xID and password
- Test validation errors
- Test successful login → should redirect to dashboard

**Test Protected Routes:**
- Without login, try accessing: `/dashboard`, `/worklist`, `/profile`
- Should redirect to `/login`

**Test Logout:**
- Login first
- Click "Logout" button
- Should redirect to `/login`
- Verify localStorage is cleared

### 2. Dashboard Testing

After logging in:
- Verify "My Open Cases" count displays
- Verify "My Pending Cases" count displays
- (Admin only) Verify "Pending Approvals" count displays
- Verify "Recently Accessed Cases" table shows data
- Click on a case row → should navigate to case detail page

### 3. Worklist Testing

Navigate to "My Worklist":
- Verify assigned cases are displayed
- Test status filters (All, Open, Pending, Closed, Filed)
- Verify case count updates when filtering
- Click on a case row → should navigate to case detail page

### 4. Case Detail Testing

Navigate to a specific case:
- Verify read-only fields display correctly (Case Name, Client ID, Category, Status)
- Verify audit history shows all changes
- Verify existing comments are displayed
- Test adding a new comment (append-only)
- Verify permission-gated actions only show for authorized users

### 5. Case Creation Testing

Navigate to "Create Case":
- Test client ID input
- Test category selector
- Test description textarea
- Test form validation
- Test duplicate client warning (409 response)
- Test force create option
- Verify successful case creation navigates to case detail

### 6. Profile Testing

Navigate to profile:
- Verify immutable fields show lock icon (Name, xID)
- Verify editable fields can be modified
- Test form validation (PAN, Aadhaar, Phone formats)
- Test saving profile changes
- Verify success/error messages display

### 7. Admin Panel Testing (Admin users only)

Navigate to "Admin":
- Verify "Pending Approvals" tab shows cases
- Verify user management tab displays placeholder
- Click on pending case → should navigate to case detail
- Test approve/reject actions (if implemented)

### 8. Error Handling Testing

**401 Unauthorized:**
- Remove xID from localStorage
- Try accessing any protected route
- Should redirect to login

**403 Forbidden:**
- As employee, try accessing admin-only features
- Should show error or redirect to dashboard

**409 Conflict:**
- Create case with duplicate client
- Should show warning panel with matched fields
- Test "Cancel" and "Continue Anyway" options

**500 Server Error:**
- Stop backend server
- Try any API operation
- Should show user-friendly error message

### 9. UI/UX Testing

**Neomorphic Design:**
- Verify soft shadows on all cards and buttons
- Verify hover states have enhanced shadows
- Verify active/pressed states have inset shadows
- Verify focus states show accessible focus rings
- Verify read-only fields have lock icons

**Responsive Design:**
- Test on desktop (1920x1080, 1366x768)
- Test on tablet (768x1024)
- Test on mobile (375x667, 414x896)
- Verify navigation collapses properly on mobile

**Accessibility:**
- Test keyboard navigation (Tab, Enter, Escape)
- Verify all interactive elements are keyboard accessible
- Verify focus indicators are visible
- Test with screen reader (optional)

## Production Build Testing

### Build for Production

```bash
cd /path/to/docketra/ui
npm run build
```

### Preview Production Build

```bash
npm run preview
```

The production preview will be available at: **http://localhost:4173**

### Verify Production Build

1. Check bundle sizes:
```bash
ls -lh dist/assets/
```

Expected sizes:
- CSS: ~14 KB (gzipped: ~3 KB)
- JS: ~230 KB (gzipped: ~75 KB)

2. Test all features in production mode
3. Check browser console for errors
4. Verify sourcemaps are generated (for debugging)

## Production Deployment

### Option 1: Static Hosting (Netlify, Vercel, etc.)

1. Build the UI:
```bash
cd ui
npm run build
```

2. Deploy the `dist/` directory to your hosting service

3. Configure environment variables:
```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

4. Configure redirects for SPA (create `_redirects` or `vercel.json`):
```
/* /index.html 200
```

### Option 2: Serve with Backend

1. Build the UI:
```bash
cd ui
npm run build
```

2. Copy `dist/` contents to backend `public/` directory:
```bash
mkdir -p ../public
cp -r dist/* ../public/
```

3. Update backend to serve static files (in `server.js`):
```javascript
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});
```

### Option 3: Docker Deployment

Create `ui/Dockerfile`:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `ui/nginx.conf`:
```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
  }
  location /api {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Build and run:
```bash
docker build -t docketra-ui .
docker run -p 80:80 docketra-ui
```

## Common Issues & Troubleshooting

### Issue: Login fails with CORS error
**Solution:** Ensure backend has CORS enabled for UI origin:
```javascript
app.use(cors({
  origin: 'http://localhost:5173', // or your production domain
  credentials: true
}));
```

### Issue: 401 errors on all API calls
**Solution:** Check that xID is being sent in headers. Verify in browser DevTools → Network → Request Headers:
```
x-user-id: <your-xid>
```

### Issue: Routes not working after page refresh
**Solution:** Ensure SPA fallback is configured:
- For dev: Vite handles this automatically
- For production: Configure web server redirects

### Issue: Environment variables not working
**Solution:** 
- Ensure `.env` file exists in `ui/` directory
- Environment variables must start with `VITE_`
- Rebuild after changing environment variables

### Issue: White screen on production
**Solution:**
- Check browser console for errors
- Verify all assets loaded correctly (Network tab)
- Ensure base path is correct in `vite.config.js`

## Performance Optimization

### Code Splitting
The build automatically splits code by routes. Verify in `dist/assets/`:
- Each page should have its own chunk
- Shared code is in vendor chunk

### Bundle Analysis
```bash
npm run build -- --mode analyze
```

### Lazy Loading
Routes are already lazy-loaded via React Router. To add more:
```javascript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

## Security Checklist

- [ ] xID sent only in headers (never in URL)
- [ ] Passwords never logged or exposed
- [ ] HTTPS in production
- [ ] Environment variables not committed
- [ ] API calls validate responses
- [ ] XSS protection (React escapes by default)
- [ ] CSRF tokens if needed (check backend)
- [ ] Content Security Policy configured

## Monitoring

### Client-Side Errors
Integrate error tracking (Sentry, LogRocket, etc.):
```javascript
// In src/index.jsx
Sentry.init({ dsn: 'your-dsn' });
```

### Performance Monitoring
Use Lighthouse or similar tools:
```bash
lighthouse http://localhost:5173 --view
```

### API Monitoring
Check Network tab for:
- Failed requests (red)
- Slow requests (>1s)
- Large payloads (>100KB)

## Next Steps

1. **Integration Testing**: Test full workflows end-to-end
2. **User Acceptance Testing**: Have stakeholders test the UI
3. **Load Testing**: Test with multiple concurrent users
4. **Documentation**: Document any discovered edge cases
5. **Training**: Create user guides and training materials

## Support

For issues or questions:
1. Check this guide first
2. Review UI README.md
3. Check browser console for errors
4. Review backend logs
5. Contact development team

## Conclusion

The Docketra Neomorphic UI is production-ready and follows all specified requirements. The UI strictly respects backend authority, handles errors gracefully, and provides a professional neomorphic design for internal use.
