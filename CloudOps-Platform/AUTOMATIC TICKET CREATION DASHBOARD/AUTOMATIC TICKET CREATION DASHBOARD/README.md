## Incident Management Dashboard (Frontend)

Production-ready frontend for managing incident tickets generated from AWS CloudWatch alarms and served via a backend API.

### Tech stack

- React (Vite)
- Tailwind CSS
- Axios
- React Router DOM
- Context API
- Recharts

### API contract

Base URL: `http://localhost:5000/api`

- `GET /tickets`
- `GET /tickets/:id`
- `PUT /tickets/:id`
- `DELETE /tickets/:id`

All responses must be JSON.

### Authentication

Hardcoded credentials:

- username: `admin`
- password: `admin123`

### Getting started

Install and run:

```bash
npm install
npm run dev
```

### Run with a local mock backend (recommended if your real backend is down)

This starts:

- Mock backend API on `http://localhost:5000/api`
- Frontend on Vite dev server (usually `http://localhost:5173`)

```bash
npm run dev:full
```

### If PowerShell blocks `npm.ps1` (ExecutionPolicy error)

If you see an error like “`npm.ps1 cannot be loaded because running scripts is disabled`”, use the Windows launchers that avoid PowerShell scripts:

- **1) Install deps (double click)**: `tools\install.cmd`
- **2) Start app (double click)**: `tools\start-dev-full.cmd`

Then open:

- Frontend: `http://localhost:5173/`
- API: `http://localhost:5000/api`

### If `npm` is blocked in PowerShell (ExecutionPolicy error)

If you see an error like “`npm.ps1 cannot be loaded because running scripts is disabled`”, don’t change system policies. Use one of these safe options:

- **Option A (recommended): double-click** `start-dev-full.cmd`
- **Option B (command line):**

```powershell
& "C:\Program Files\nodejs\node.exe" tools\run-dev-full.js
```

Then open:

- Frontend: `http://localhost:5173/`
- API: `http://localhost:5000/api`

### Fixing `ERR_CONNECTION_REFUSED` quickly

If you see `ERR_CONNECTION_REFUSED` for `http://localhost:5000/api`, the frontend is fine but **nothing is accepting connections on port 5000**.

Fastest checks:

- **Check the backend is running**: start your API server and confirm it logs “listening on 5000”.
- **Verify the port is listening (Windows)**:

```powershell
netstat -ano | findstr :5000
```

- **Verify the API responds**:

```powershell
curl http://localhost:5000/api/tickets
```

- **If backend runs on another port**: create `.env` from `.env.example` and set `VITE_API_BASE_URL`.


Build for production:

```bash
npm run build
npm run preview
```

### Project structure (required)

`/src`

- `components/` reusable UI components
- `pages/` route pages
- `context/` auth/theme/toast context
- `services/` Axios + API functions
- `hooks/` reusable hooks (polling)
- `utils/` constants + formatting helpers
- `layouts/` app shell layout

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
