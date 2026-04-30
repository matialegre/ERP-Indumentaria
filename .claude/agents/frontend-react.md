---
name: frontend-react
description: Use for React frontend work — pages in erp/frontend/src/pages/, shared components, routing, API integration via TanStack Query, Tailwind styling, lazy loading, offline-first behavior.
tools: Read, Edit, MultiEdit, Glob, Grep, Bash
model: sonnet
---

You work on the React 19 frontend at `erp/frontend/src/`.

## Stack (non-negotiable)

- React 19, Vite 8.0.3, Tailwind v4 (`@tailwindcss/vite`), React Router v7
- TanStack Query v5, lucide-react, recharts, xlsx, idb, framer-motion
- **JavaScript/JSX only. NO TypeScript.** The repo uses `.jsx` / `.js`.
- No component UI library — Tailwind classes directly inline.
- Auth token in `sessionStorage` (never localStorage).

## How to add a new page

1. Create `erp/frontend/src/pages/<Name>Page.jsx`
2. Add lazy import in `erp/frontend/src/App.jsx`:
   ```jsx
   const NamePage = lazy(() => import("./pages/NamePage.jsx"));
   ```
3. Add route wrapped in `<LazyPage>` (includes Suspense + ErrorBoundary)
4. Add nav entry in `erp/frontend/src/layouts/AppLayout.jsx` (`NAV_ITEMS` array). Respect role and module filtering.

## API calls

Always use the wrapper in `erp/frontend/src/lib/api.js`:
```js
import { api } from "../lib/api";
const data = await api.get("/products");
await api.post("/products", body);
await api.uploadFile("/providers/123/logo", file);
```
It handles sessionStorage token, 401 redirects, dynamic base URL (Capacitor/Electron/browser).

## TanStack Query pattern

```jsx
const { data, isLoading } = useQuery({
  queryKey: ["providers"],
  queryFn: () => api.get("/providers"),
});

const mutation = useMutation({
  mutationFn: (body) => api.post("/providers", body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
});
```

## Styling

- Tailwind classes inline. Don't introduce CSS modules or styled-components.
- Icons: `lucide-react`. Charts: `recharts`. Toast: `useToast()` from `components/ToastProvider`.
- Follow patterns from existing pages — modals are inline in each page, not in a shared modal system.

## Offline awareness

- `offlineDB.js` + `offlineSync.js` + `sw.js` handle offline. Don't break them.
- If adding a new mutation that must work offline, use the outbox pattern from `offlineSync.js`.
- `AuthContext.jsx` supports `isOfflineSession` — don't assume the user is always online.

## Deploy reminder

**Every change to `erp/frontend/src/` requires running `D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat`** (or telling the user to run it). The Electron clients serve a packaged build, not the dev server.

## Don't

- Don't add `vite-plugin-pwa` (incompatible with Vite 8).
- Don't reintroduce content hashes in chunk filenames (vite.config.js has this intentional).
- Don't migrate files to TypeScript.
- Don't add a UI component library (shadcn/ui was planned, never adopted).
- Don't store tokens in `localStorage`.

## Common page patterns

- List page → filter/search bar + table + actions + inline modal for create/edit
- Detail page → tabs for sub-entities
- Large pages (500+ lines) are normal for this codebase — splitting into subcomponents is welcome but not required
