<div align="center">
  
<br>

<h1> Valtio-Select </h1>

**Fine-grained** subscriptions to [`Valtio`](https://github.com/pmndrs/valtio) proxies with **automatic re-tracking** on structural changes.

[![types: Typescript](https://img.shields.io/badge/types-Typescript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Github CI](https://img.shields.io/github/actions/workflow/status/ts-zen/valtio-select/ci.yml?style=flat-square&branch=main)](https://github.com/ts-zen/valtio-select/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/ts-zen/valtio-select?color=44cc11&logo=codecov&style=flat-square)](https://codecov.io/gh/ts-zen/valtio-select)
[![code style: Prettier](https://img.shields.io/badge/code_style-Prettier-ff69b4.svg?style=flat-square&logo=prettier)](https://prettier.io/)
[![npm](https://img.shields.io/npm/v/valtio-select.svg?style=flat-square)](http://npm.im/valtio-select)
[![Bundle Size](https://img.shields.io/bundlejs/size/valtio-select?style=flat-square&label=size&logo=esbuild&color=FFCF00)](https://bundlejs.com/?q=valtio-select)

</div>

## 📚 Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
  - [How It Solves Each Problem](#how-it-solves-each-problem)
    - [Nullable Arguments](#1-nullable-arguments)
    - [Structural Changes](#2-structural-changes)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Example](#basic-example)
  - [Deep Nesting](#deep-nesting)
  - [Handling Structural Changes](#handling-structural-changes)
  - [Advanced Patterns](#advanced-patterns)
    - [Computed Values](#computed-values)
    - [Conditional Access](#conditional-access)
- [API Reference](#api-reference)
  - [useTrackedSnapshot(proxy, getSnapshot)](#usetrackedsnapshotproxy-getsnapshot)
  - [subscribeTracked(proxy, getter, callback)](#subscribetrackedproxy-getter-callback)
- [How It Works](#how-it-works)
- [Performance](#performance)
  - [Subscription Count](#subscription-count)
  - [Re-render Optimization](#re-render-optimization)
  - [Memory Management](#memory-management)
- [Comparison with useSnapshot](#comparison-with-usesnapshot)
- [Requirements](#requirements)
- [License](#license)
- [Contributing](#contributing)

## The Problem

Valtio's `useSnapshot` hook has three significant limitations that make it difficult to work with in real-world applications:

### 1. Cannot Pass Nullable Arguments

`useSnapshot` doesn't accept nullable proxies, requiring verbose workarounds:

```tsx
const state = proxy({ user: null });

// ❌ This throws when user is null
function UserProfile() {
  const user = useSnapshot(state.user); // Error!
  return <div>{user.name}</div>;
}
```

Working with deeply nested optional structures requires complex null checks that
are hard to optimize:

```tsx
const state = proxy<{
  user?: {
    profile?: {
      settings?: {
        theme: "dark" | "light";
      };
    };
  };
}>({});

// ❌ Verbose and error-prone
function ThemeDisplay() {
  const snapshot = useSnapshot(state);
  const theme = snapshot?.user?.profile?.settings?.theme;

  return <div>Theme: {theme}</div>;
}
```

### 2. Structural Changes Don't Notify Subtrees

When the structure of an object changes, components subscribing to nested properties don't re-render:

```tsx
const state = proxy({ user: { name: "John", age: 30 } });

function UserName() {
  // Subscribes to the current user object
  const user = useSnapshot(state.user);
  return <div>{user.name}</div>;
}

// Later in your code...
state.user = { name: "Jane", age: 25 }; // Replace entire object

// ❌ Problem: UserName component still shows 'John'
// It's subscribed to the OLD user object, not the NEW one
```

This is a fundamental limitation because `useSnapshot` creates subscriptions when the component first renders, and those subscriptions don't automatically update when parent objects are replaced.

## The Solution

`useTrackedSnapshot` solves all three problems with a selector-based approach:

```tsx
import { proxy } from "valtio";
import { useTrackedSnapshot } from "valtio-select";

const state = proxy({ user: null as { name: string } | null });

function UserProfile() {
  // ✅ Works with nullable state
  const name = useTrackedSnapshot(state, (s) => s.user?.name ?? "Guest");
  return <div>Welcome, {name}!</div>;
}
```

### How It Solves Each Problem

#### 1. Nullable Arguments

Selectors handle null/undefined gracefully with optional chaining:

```tsx
// ✅ Clean and safe
const userName = useTrackedSnapshot(state, (s) => s.user?.name);
```

Extract exactly what you need without intermediate snapshots:

```tsx
// ✅ Direct access to deeply nested values
const theme = useTrackedSnapshot(
  state,
  (s) => s.data?.user?.profile?.settings?.theme ?? "light"
);
```

#### 2. Structural Changes

Automatically re-subscribes when structure changes:

```tsx
function UserName() {
  // ✅ Always subscribes to current user, even if replaced
  const name = useTrackedSnapshot(state, (s) => s.user.name);
  return <div>{name}</div>;
}

// When you replace the user object...
state.user = { name: "Jane", age: 25 };

// ✅ Component automatically re-renders with 'Jane'
```

**How it works**: When any tracked property changes, `useTrackedSnapshot`:

1. Re-runs your selector to see what's currently accessed
2. Rebuilds subscriptions to match the current structure
3. Notifies React to re-render

This ensures your subscriptions always match your current state structure.

## Installation

```bash
# npm
npm install valtio-select valtio
```

```bash
# yarn
yarn add valtio-select valtio
```

```bash
# pnpm
pnpm add valtio-select valtio
```

```bash
# bun
bun add valtio-select valtio
```

## Usage

### Basic Example

```tsx
import { proxy } from "valtio";
import { useTrackedSnapshot } from "valtio-select";

// Create your Valtio state
const state = proxy({
  count: 0,
  user: { name: "John", age: 30 },
});

function Counter() {
  // Only subscribes to 'count'
  const count = useTrackedSnapshot(state, (s) => s.count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => state.count++}>Increment</button>
    </div>
  );
}

function UserName() {
  // Only subscribes to 'user.name'
  const name = useTrackedSnapshot(state, (s) => s.user.name);

  return <div>User: {name}</div>;
}
```

### Deep Nesting

```tsx
const state = proxy({
  app: {
    settings: {
      theme: {
        mode: "dark" as "dark" | "light",
        primaryColor: "#007bff",
      },
    },
  },
});

function ThemeToggle() {
  const mode = useTrackedSnapshot(state, (s) => s.app.settings.theme.mode);

  const toggleTheme = () => {
    state.app.settings.theme.mode = mode === "dark" ? "light" : "dark";
  };

  return <button onClick={toggleTheme}>Current theme: {mode}</button>;
}
```

### Handling Structural Changes

```tsx
const state = proxy({
  currentUser: null as {
    id: number;
    profile: { name: string; email: string };
  } | null,
});

function UserProfile() {
  const profile = useTrackedSnapshot(state, (s) => s.currentUser?.profile);

  if (!profile) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h2>{profile.name}</h2>
      <p>{profile.email}</p>
    </div>
  );
}

// When user logs in, component automatically updates
function login() {
  state.currentUser = {
    id: 1,
    profile: { name: "John", email: "john@example.com" },
  };
}

// When user logs out, component automatically updates
function logout() {
  state.currentUser = null;
}
```

### Advanced Patterns

#### Computed Values

```tsx
const state = proxy({
  todos: [
    { id: 1, text: "Buy milk", completed: false },
    { id: 2, text: "Walk dog", completed: true },
  ],
});

function TodoStats() {
  const todos = useTrackedSnapshot(state, (s) => s.todos);

  const stats = useMemo(
    () => ({
      total: todos.length,
      completed: todos.filter((t) => t.completed).length,
      active: todos.filter((t) => !t.completed).length,
    }),
    [todos]
  );

  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Completed: {stats.completed}</p>
      <p>Active: {stats.active}</p>
    </div>
  );
}
```

#### Conditional Access

```tsx
const state = proxy({
  view: "grid" as "grid" | "list",
  gridSettings: { columns: 3 },
  listSettings: { density: "comfortable" },
});

function ViewSettings() {
  const settings = useTrackedSnapshot(state, (s) =>
    s.view === "grid" ? s.gridSettings : s.listSettings
  );

  // TypeScript knows: settings is { columns: number } | { density: string }
  return <div>{JSON.stringify(settings)}</div>;
}
```

## API Reference

### useTrackedSnapshot(proxy, getSnapshot)

Creates a fine-grained subscription to a Valtio proxy using a selector function.

#### Parameters

- **proxy**: `T extends object`

  - The Valtio proxy object to track
  - Must be an object (not primitive, null, or undefined)
  - Can be any Valtio proxy created with `proxy()`

- **getSnapshot**: `(proxy: T) => R`
  - A function that extracts the desired data from the proxy
  - Receives the proxy as its parameter
  - Should return any value (primitive, object, array, etc.)
  - Should be a stable reference (wrapped in `useCallback` if it has dependencies)

#### Returns

- **R** - The result of `getSnapshot`, re-computed when tracked properties change

#### Behavior

1. **Initial Render**: Calls `getSnapshot` with a tracking proxy that records all property accesses
2. **Subscriptions**: Creates fine-grained subscriptions to only the accessed properties
3. **Updates**: When any subscribed property changes:
   - Re-runs `getSnapshot` with the real proxy
   - Rebuilds subscriptions to handle structural changes
   - Triggers React re-render if the result changed
4. **Cleanup**: Automatically unsubscribes when component unmounts

#### Important Notes

- **Selector Stability**: For best performance, memoize your selector function:

  ```tsx
  const selector = useCallback((s) => s.user.name, []);
  const name = useTrackedSnapshot(state, selector);
  ```

- **Tracked Properties**: Only properties accessed during `getSnapshot` are tracked. Conditional access means conditional tracking:

  ```tsx
  // If condition is true, tracks 'a'. If false, tracks 'b'
  const value = useTrackedSnapshot(state, (s) => (condition ? s.a : s.b));
  ```

- **Structural Changes**: When an object is replaced, subscriptions automatically rebuild:

  ```tsx
  // Component initially subscribes to original user object
  const name = useTrackedSnapshot(state, (s) => s.user.name);

  // When user is replaced, component re-subscribes to new user
  state.user = { name: "Jane" };
  ```

### subscribeTracked(proxy, getter, callback)

The core, non-React subscription function that powers `useTrackedSnapshot`. It provides the same fine-grained, auto-re-tracking subscription logic for use in any JavaScript/TypeScript environment.

This is useful for integrating tracked state with non-React libraries, vanilla TypeScript logic, or for building your own custom hooks and abstractions.

#### Parameters

- **proxy**: `T extends object`

  - The Valtio proxy object to track.

- **getter**: `(proxy: T) => unknown`

  - A function that accesses properties on the proxy. The properties accessed within this function will be tracked.

- **callback**: `() => void`
  - The function to be called whenever a tracked property changes.

#### Returns

- **unsubscribe**: `() => void`
  - A function that cleans up and removes the subscription.

#### Example

```ts
import { proxy } from "valtio";
import { subscribeTracked } from "valtio-select";

const state = proxy({ count: 0, other: "data" });

console.log("Subscribing to state.count");

const unsubscribe = subscribeTracked(
  state,
  (s) => s.count, // The getter tracks this property
  () => console.log("Count changed!", state.count)
);

// This will trigger the callback
state.count++; // Logs: Count changed! 1

// This will NOT trigger the callback because 'other' is not tracked
state.other = "new data";

// Clean up the subscription
unsubscribe();
console.log("Unsubscribed.");

// This will no longer trigger the callback
state.count++;
```

## How It Works

`useTrackedSnapshot` uses a multi-layered tracking mechanism:

### 1. Tracking Proxy

During the initial render and after structural changes, the selector runs with a special tracking proxy that records every property access:

```tsx
const trackingProxy = new Proxy(state, {
  get(target, prop) {
    recordAccess(target, prop); // Record this access
    const value = target[prop];

    // Recursively wrap nested objects
    if (value && typeof value === "object") {
      return new Proxy(value, handler);
    }

    return value;
  },
});
```

### 2. Fine-Grained Subscriptions

After tracking, the hook creates individual subscriptions for each accessed property using Valtio's `subscribeKey`:

```tsx
// If selector accessed state.user.name and state.user.email
subscribeKey(state.user, "name", handleChange);
subscribeKey(state.user, "email", handleChange);
```

### 3. Automatic Re-tracking

When any subscribed property changes, the hook:

1. **Cleans up** old subscriptions
2. **Re-runs** the selector with the tracking proxy
3. **Creates new** subscriptions based on current accesses
4. **Notifies** React to re-render

This ensures subscriptions always match the current structure, solving the structural change problem.

### 4. Integration with React

Uses React's `useSyncExternalStore` for:

- Proper React 18 concurrent mode support
- Automatic server-side rendering compatibility
- Correct timing of subscriptions and updates

## Performance

### Subscription Count

Only accessed properties are subscribed to, minimizing overhead:

```tsx
// Subscribes to 3 properties: state.user, user.profile, profile.name
const name = useTrackedSnapshot(state, (s) => s.user.profile.name);

// Subscribes to 2 properties: state.count, state.total
const percentage = useTrackedSnapshot(state, (s) => (s.count / s.total) * 100);
```

### Re-render Optimization

Components only re-render when their specific data changes:

```tsx
const state = proxy({ a: 1, b: 2, c: 3 });

// Component 1 only re-renders when 'a' changes
function CompA() {
  const a = useTrackedSnapshot(state, (s) => s.a);
  return <div>{a}</div>;
}

// Component 2 only re-renders when 'b' changes
function CompB() {
  const b = useTrackedSnapshot(state, (s) => s.b);
  return <div>{b}</div>;
}

// Changing 'c' doesn't re-render either component
state.c = 4;
```

### Memory Management

Subscriptions are automatically cleaned up:

- When the component unmounts
- When the selector function changes
- During re-tracking after structural changes

## Comparison with useSnapshot

| Feature                  | useSnapshot                        | useTrackedSnapshot              |
| ------------------------ | ---------------------------------- | ------------------------------- |
| **Nullable proxies**     | ❌ Throws error                    | ✅ Works with optional chaining |
| **Deep nesting**         | ⚠️ Requires intermediate snapshots | ✅ Direct selector access       |
| **Structural changes**   | ❌ Stale subscriptions             | ✅ Auto re-tracking             |
| **Fine-grained updates** | ✅ Full snapshot                   | ✅ Selector-based               |
| **Type inference**       | ✅ Full                            | ✅ Full                         |
| **API complexity**       | Simple                             | Simple                          |

### When to use `useSnapshot`

- You need a complete snapshot of an object
- Your component uses many properties from the same object
- State structure is stable and never replaced

### When to use `useTrackedSnapshot`

- Working with nullable/optional state
- Accessing deeply nested properties
- Objects are frequently replaced (structural changes)
- Need maximum re-render optimization
- Extracting computed/transformed values

## TypeScript

Full TypeScript support with complete type inference:

```tsx
const state = proxy({
  count: 0,
  user: { name: "John", age: 30 } as { name: string; age: number } | null,
  items: [1, 2, 3],
});

// Type: number
const count = useTrackedSnapshot(state, (s) => s.count);

// Type: string | undefined
const name = useTrackedSnapshot(state, (s) => s.user?.name);

// Type: number[]
const doubled = useTrackedSnapshot(state, (s) => s.items.map((x) => x * 2));

// Type: { total: number; average: number }
const stats = useTrackedSnapshot(state, (s) => ({
  total: s.items.length,
  average: s.items.reduce((a, b) => a + b, 0) / s.items.length,
}));
```

## Requirements

- **React** 18.0.0 or higher (uses `useSyncExternalStore`)
- **Valtio** 1.0.0 or higher

## License

Copyright © 2025 [**tszen**](https://github.com/ts-zen) • [**MIT license**](LICENSE).

## Contributing

Contributions are welcome! Please read our [contributing guide](CONTRIBUTING.md).

<div align="center">

**[Documentation](https://github.com/ts-zen/valtio-select#readme)** •
**[Issues](https://github.com/ts-zen/valtio-select/issues)** •
**[NPM](https://www.npmjs.com/package/valtio-select)**

Made with ❤️ for the React community

</div>
