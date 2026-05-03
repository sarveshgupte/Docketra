# Docketra UI

React + Vite frontend for the Docketra B2B firm operations SaaS platform.

## Tech stack

- **React 18** with hooks
- **React Router v6** (firm-scoped routing: `/:firmSlug/login`, `/app/firm/:firmSlug/*`)
- **Vite 5** for bundling and dev server
- **TailwindCSS 3** for styling
- **TanStack Query v5** for data fetching and cache management
- **react-hook-form + yup** for form validation
- **Axios** for API calls with JWT cookie-based auth
- **framer-motion** for animations (vendored)
- **socket.io-client** for real-time updates

## Quick start

### Prerequisites

- Node.js **18.x** (Node 20 LTS also supported)
- Docketra backend running on `http://localhost:5000`

### Installation

```bash
# From the repo root
npm --prefix ui install

# Or from inside ui/
cd ui
npm install
```

### Configure environment

```bash
cp ui/.env.example ui/.env
```

The default `.env.example` already sets `VITE_API_BASE_URL=http://localhost:5000/api`. No edits needed unless your backend is on a different port.

### Start the dev server

```bash
npm --prefix ui run dev
```

Open `http://localhost:5173` in your browser.

### Build for production

```bash
npm --prefix ui run build
```

Built files go to `ui/dist/`.

### Preview production build

```bash
npm --prefix ui run preview
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |
| `VITE_SUPPORT_EMAIL` | Support email shown in help UI | `support@docketra.com` |
| `VITE_ENABLE_PROD_SOURCEMAPS` | Enable production source maps | `false` |
| `VITE_ENABLE_GOOGLE_LOGIN` | Show Google login option | `false` |

All `VITE_*` variables are bundled into the client build and are publicly readable. Do not store secrets here.

## Project structure

```
ui/
├── public/                # Static assets
├── src/
│   ├── api/               # API client modules (axios wrappers per domain)
│   ├── assets/            # CSS and static assets
│   ├── auth/              # Auth utilities and guards
│   ├── components/
│   │   ├── common/        # Shared UI components
│   │   └── platform/      # PlatformShell — the authenticated workspace shell
│   ├── constants/
│   │   ├── platformNavigation.js   # Sidebar nav blueprint
│   │   └── routes.js               # Route constants
│   ├── contexts/          # React contexts (Auth, Toast, etc.)
│   ├── design/            # Design tokens and system components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page-level components
│   ├── routes/            # Route definitions and ProtectedRoutes
│   ├── services/          # Higher-level service abstractions
│   ├── styles/            # Global styles
│   ├── theme/             # Theme constants
│   ├── utils/             # Utility functions
│   ├── App.jsx            # App root
│   ├── Router.jsx         # Top-level router
│   └── index.jsx          # Entry point
├── tests/                 # Static analysis / smoke tests (.mjs)
├── .env.example           # Environment variable template
├── index.html             # Vite entry HTML
├── package.json
├── vite.config.js
└── README.md              # This file
```

## Authentication model

- Authentication uses **JWT cookie-based sessions** (HTTP-only cookies set by the backend).
- Login flows:
  - Firm users: `/:firmSlug/login` → password or OTP-based login.
  - Superadmin: `/superadmin/login` → separate credential store.
- On successful auth, the backend sets a JWT access cookie. The frontend does not store tokens in localStorage.
- Expired sessions trigger automatic redirect:
  - Firm routes redirect to `/:firmSlug/login`.
  - Superadmin routes redirect to `/superadmin/login`.
- Protected routes are enforced via `ProtectedRoutes.jsx`.

## Workspace shell

`PlatformShell` (`src/components/platform/PlatformShell.jsx`) is the single authenticated workspace shell for all firm workspace pages. It renders the sidebar, header, and page outlet. The older `Layout` component is deprecated — do not use it for new pages.

## Navigation and product labels

UI copy uses product labels; internal route segments use technical names:

| Product label | Internal route segment |
|--------------|------------------------|
| Work | `/task-manager` |
| Dashboard | `/dashboard` |
| Knowledge Intake | `/cms` |
| Relationships | `/crm` |
| Company Brain | `/company-brain` |
| Knowledge Library | `/knowledge` |
| Clients | `/clients` |
| Reports | `/admin/reports` |
| Team & Access | `/admin` |
| Settings | `/settings` |

Full route constants are in `src/constants/routes.js`.

## Role hierarchy

Roles (highest to lowest): `PRIMARY_ADMIN` → `ADMIN` → `MANAGER` → `USER`.

Navigation items and UI controls respect `minRole` requirements defined in `platformNavigation.js`. All permission enforcement is ultimately done by the backend — the UI only shows/hides based on role context received from auth responses.

## Testing

```bash
# Run the 17-test CI suite (static analysis, no browser required)
npm --prefix ui run test:ci

# Individual test groups
npm --prefix ui run test:shells          # workspace shell unification
npm --prefix ui run test:sidebar-active  # sidebar active state reliability
npm --prefix ui run test:command-center  # command center contract

# Frontend build check
npm --prefix ui run build
```

All tests in `ui/tests/` are static analysis tests written as `.mjs` files. No browser or jsdom is required.

## Backend integration

- All API calls go through `VITE_API_BASE_URL` (defaults to `/api` for production when backend serves frontend).
- 401 responses trigger automatic logout and redirect to the appropriate login page.
- 403 responses show an error state without redirect.
- All permissions come from backend responses — the UI does not enforce permissions client-side.

## Contributing

- Backend is the single source of truth for data and permissions.
- New firm workspace pages must use `PlatformShell`.
- Use product labels in UI copy; internal route segments are acceptable in code only.
- Handle loading, error, and empty states for all async data.
- Do not add `TODO` comments to production code.
