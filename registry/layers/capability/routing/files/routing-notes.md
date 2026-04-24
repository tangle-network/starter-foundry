# Routing

`react-router-dom` v7. `createBrowserRouter` for SPA, `createMemoryRouter` for tests/Electron.

## When to add a route

1. Add an entry to the children array in `src/router.tsx`.
2. If the route has dynamic params, use `:id` in the path + `useParams()` in the component.
3. For nested layouts (tab shells, sidebars), nest children under a parent that renders `<Outlet />`.

## Navigation

- `<Link to="/foo">` — basic nav link.
- `<NavLink to="/foo">` — auto-applies `isActive` class; use for nav bars.
- `useNavigate()` — programmatic (after form submit, auth callback, etc.).
- `useSearchParams()` — query-string state (e.g. `?tab=details`). Stays in URL, shareable.

## Data

Prefer loader/action route data hooks over global state for page-scoped fetches:

```tsx
{ path: 'proposals/:id', element: <ProposalPage />,
  loader: ({ params }) => fetchProposal(params.id),
}
// in ProposalPage: const proposal = useLoaderData() as Proposal
```

## Gotchas

- `react-router-dom` v7 merged with Remix. APIs stable from v6 but import paths shifted — if you see "no export named X" on a v6 import, check the v7 migration guide.
- For Electron/Tauri: use `createHashRouter` instead of `createBrowserRouter` — file:// URLs don't play nice with history mode.
- SSR needs explicit data loaders + `createStaticRouter`; this scaffold is SPA-only.
