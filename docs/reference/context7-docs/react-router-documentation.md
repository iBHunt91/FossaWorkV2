# React Router Documentation Reference

This documentation was fetched from Context7 for the React Router library (`/remix-run/react-router`).

## Table of Contents

1. [Installation and Setup](#installation-and-setup)
2. [Basic Routing](#basic-routing)
3. [Route Configuration](#route-configuration)
4. [Navigation](#navigation)
5. [Data Loading](#data-loading)
6. [Forms and Actions](#forms-and-actions)
7. [Nested Routes](#nested-routes)
8. [Advanced Features](#advanced-features)

---

## Installation and Setup

### Creating a New React Router Project

```shellscript
npx create-react-router@latest my-react-router-app
```

### Basic Router Setup

```typescript
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router";
import React from "react";
import ReactDOM from "react-dom/client";

const router = createBrowserRouter([
  {
    path: "/",
    element: <div>Hello World</div>,
  },
]);

const root = document.getElementById("root");

ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />
);
```

### Declarative Mode Setup

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./app";

const root = document.getElementById("root");

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

---

## Basic Routing

### Route Configuration with createBrowserRouter

```tsx
const router = createBrowserRouter([
  {
    path: "/",
    Component: MyRouteComponent,
  },
]);

function MyRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>I'm still using React Router after like 10 years.</p>
    </div>
  );
}
```

### Declarative Routes with Routes Component

```tsx
import { BrowserRouter, Routes, Route } from "react-router";

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
    </Routes>
  </BrowserRouter>
);
```

### Index Routes

```ts
{ index: true, Component: Home }
```

---

## Route Configuration

### Route Object Properties

```tsx
createBrowserRouter([
  {
    path: "/app",
    Component: AppLayout,
    loader: appLoader,
    action: appAction,
    errorElement: <ErrorBoundary />,
    children: [
      // nested routes
    ]
  },
]);
```

### Lazy Loading Routes

```tsx
createBrowserRouter([
  {
    path: "/app",
    lazy: async () => {
      // load component and loader in parallel before rendering
      const [Component, loader] = await Promise.all([
        import("./app"),
        import("./app-loader"),
      ]);
      return { Component, loader };
    },
  },
]);
```

---

## Navigation

### NavLink Component

```tsx
import { NavLink } from "react-router";

export function MyAppNav() {
  return (
    <nav>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/trending" end>
        Trending Concerts
      </NavLink>
      <NavLink to="/concerts">All Concerts</NavLink>
      <NavLink to="/account">Account</NavLink>
    </nav>
  );
}
```

### Link Component

```tsx
import { Link } from "react-router";

export function LoggedOutMessage() {
  return (
    <p>
      You've been logged out.{" "}
      <Link to="/login">Login again</Link>
    </p>
  );
}
```

### Programmatic Navigation

```tsx
import { useNavigate } from "react-router";

function MyComponent() {
  const navigate = useNavigate();
  
  // Navigate to a specific route
  navigate("/some/route");
  
  // Replace current history entry
  navigate("/some/route", { replace: true });
  
  // Navigate back
  navigate(-1);
  
  // Navigate forward
  navigate(1);
}
```

---

## Data Loading

### Loader Functions

```tsx
import type { Route } from "./+types/product";
import { fakeDb } from "../db";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await fakeDb.getProduct(params.pid);
  return product;
}

export default function Product({
  loaderData,
}: Route.ComponentProps) {
  const { name, description } = loaderData;
  return (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  );
}
```

### Accessing Route Parameters

```javascript
import { useParams } from "react-router";

function City() {
  let { city } = useParams();
  let data = useFakeDataLibrary(`/api/v2/cities/${city}`);
  // ...
}
```

### Using Search Parameters

```typescript
import { Form, useSearchParams } from "react-router";

export function List() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "list";

  return (
    <div>
      <Form>
        <button name="view" value="list">
          View as List
        </button>
        <button name="view" value="details">
          View with Details
        </button>
      </Form>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```

---

## Forms and Actions

### Basic Form Submission

```tsx
import { Form } from "react-router";

export function AddToCart({ id }) {
  return (
    <Form method="post" action="/add-to-cart">
      <input type="hidden" name="id" value={id} />
      <button type="submit">Add To Cart</button>
    </Form>
  );
}
```

### Action Functions

```tsx
import type { Route } from "./+types/signup";
import { redirect, data } from "react-router";

export async function action({
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const errors = {};

  if (!email.includes("@")) {
    errors.email = "Invalid email address";
  }

  if (password.length < 12) {
    errors.password = "Password should be at least 12 characters";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  // Redirect to dashboard if validation is successful
  return redirect("/dashboard");
}
```

### Using Fetchers

```tsx
import { useFetcher } from "react-router";

export function AddToCart({ id }) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form method="post" action="/add-to-cart">
      <input name="id" value={id} />
      <button type="submit">
        {fetcher.state === "submitting"
          ? "Adding..."
          : "Add To Cart"}
      </button>
    </fetcher.Form>
  );
}
```

### Imperative Fetcher Submit

```javascript
fetcher.submit(
  { title: "New Title" },
  { action: "/update-task/123", method: "post" }
);
```

---

## Nested Routes

### Nested Route Configuration

```ts
import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  // parent route
  route("dashboard", "./dashboard.tsx", [
    // child routes
    index("./home.tsx"),
    route("settings", "./settings.tsx"),
  ]),
] satisfies RouteConfig;
```

### Outlet Component

```tsx
import { Outlet } from "react-router";

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* will either be <Home/> or <Settings/> */}
      <Outlet />
    </div>
  );
}
```

### Root Layout Component

```tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>My App</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
```

---

## Advanced Features

### Type-Safe Route Modules

```tsx
import type { Route } from "./+types/product";

export function loader({ params }: Route.LoaderArgs) {
  //                      👆 { id: string }
  return { planet: `world #${params.id}` };
}

export default function Component({
  loaderData, // 👈 { planet: string }
}: Route.ComponentProps) {
  return <h1>Hello, {loaderData.planet}!</h1>;
}
```

### Session Management

```tsx
import { data, redirect } from "react-router";
import type { Route } from "./+types/login";
import {
  getSession,
  commitSession,
} from "../sessions.server";

export async function loader({
  request,
}: Route.LoaderArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );

  if (session.has("userId")) {
    return redirect("/");
  }

  return data(
    { error: session.get("error") },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export async function action({
  request,
}: Route.ActionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  const userId = await validateCredentials(
    username,
    password
  );

  if (userId == null) {
    session.flash("error", "Invalid username/password");
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  session.set("userId", userId);
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

### Type-Ahead Search with Race Condition Prevention

```typescript
export function CitySearchCombobox() {
  const fetcher = useFetcher();

  return (
    <fetcher.Form action="/city-search">
      <Combobox aria-label="Cities">
        <ComboboxInput
          name="q"
          onChange={(event) =>
            // submit the form onChange to get the list of cities
            fetcher.submit(event.target.form)
          }
        />

        {fetcher.data ? (
          <ComboboxPopover className="shadow-popup">
            {fetcher.data.length > 0 ? (
              <ComboboxList>
                {fetcher.data.map((city) => (
                  <ComboboxOption
                    key={city.id}
                    value={city.name}
                  />
                ))}
              </ComboboxList>
            ) : (
              <span>No results found</span>
            )}
          </ComboboxPopover>
        ) : null}
      </Combobox>
    </fetcher.Form>
  );
}
```

### Meta Tags in React 19+

```tsx
export default function MyRoute() {
  return (
    <div>
      <title>Very cool app</title>
      <meta property="og:title" content="Very cool app" />
      <meta
        name="description"
        content="This app is the best"
      />
      {/* The rest of your route content... */}
    </div>
  );
}
```

---

## Additional Resources

- Trust Score: 7.5/10
- Code Snippets Available: 838
- Source: React Router Official Documentation (remix-run/react-router)