import { createBrowserRouter, RouterProvider, Outlet, Link, NavLink } from 'react-router-dom'

// Default layout — renders top-level nav + an <Outlet /> for nested routes.
// Replace with your app shell. `NavLink` auto-applies the `.active` class
// when the path matches, which shadcn styling picks up via `&[aria-current=page]`.
function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="font-semibold">Home</Link>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'text-primary' : 'text-muted-foreground'}>
            About
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}

function HomePage() {
  return <div className="space-y-2"><h1 className="text-2xl font-semibold">Home</h1></div>
}

function AboutPage() {
  return <div className="space-y-2"><h1 className="text-2xl font-semibold">About</h1></div>
}

function NotFoundPage() {
  return <div className="space-y-2"><h1 className="text-2xl font-semibold">404</h1><p>No route matches.</p></div>
}

// Register routes here. Nested routes inherit the parent's <Outlet /> so the
// RootLayout chrome stays constant across navigations — no full page reloads.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      // Add routes here. For /foo/:id detail views:
      //   { path: 'foo', children: [
      //     { index: true, element: <FooListPage /> },
      //     { path: ':id', element: <FooDetailPage /> },
      //   ]},
    ],
  },
])

// Mount in main.tsx like so:
//   import { RouterProvider } from 'react-router-dom'
//   import { router } from './router'
//   createRoot(document.getElementById('root')!).render(
//     <RouterProvider router={router} />
//   )
export function AppRouter() {
  return <RouterProvider router={router} />
}
