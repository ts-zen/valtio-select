import { expectError, expectType } from "tsd";
import { proxy } from "valtio";
import { subscribeTracked } from "./subscribeTracked";

/**
 * Type tests for subscribeTracked
 *
 * Validates that:
 * 1. Function signature matches Valtio's subscribe pattern
 * 2. Type inference works correctly
 * 3. Invalid usage produces type errors
 */

// =============================================================================
// Basic Signature Tests
// =============================================================================

/**
 * Test: Should accept valid arguments.
 */
{
  const state = proxy({ count: 0 });
  const unsubscribe = subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
  expectType<() => void>(unsubscribe);
}

/**
 * Test: Should infer proxy type correctly in getter.
 */
{
  const state = proxy({ count: 0, name: "test" });
  subscribeTracked(
    state,
    (s) => {
      expectType<{ count: number; name: string }>(s);
      return s.count;
    },
    () => {},
  );
}

/**
 * Test: Should work with different return types from getter.
 */
{
  const state = proxy({ count: 0, name: "test" });

  // Return number
  subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );

  // Return string
  subscribeTracked(
    state,
    (s) => s.name,
    () => {},
  );

  // Return object
  subscribeTracked(
    state,
    (s) => ({ count: s.count }),
    () => {},
  );

  // Return void
  subscribeTracked(
    state,
    (s) => {
      void s.count;
    },
    () => {},
  );
}

// =============================================================================
// Proxy Type Constraints
// =============================================================================

/**
 * Test: Should accept objects.
 */
{
  const state = proxy({ value: 0 });
  subscribeTracked(
    state,
    (s) => s.value,
    () => {},
  );
}

/**
 * Test: Should accept arrays (arrays are objects).
 */
{
  const state = proxy([1, 2, 3]);
  subscribeTracked(
    state,
    (s) => s[0],
    () => {},
  );
}

/**
 * Test: Should accept objects with interfaces.
 */
{
  interface State {
    count: number;
    name: string;
  }
  const state = proxy<State>({ count: 0, name: "test" });
  subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
}

/**
 * Test: Should reject primitives.
 */
{
  subscribeTracked(
    // @ts-expect-error - boolean is not an object
    42,
    (s) => s,
    () => {},
  );

  subscribeTracked(
    // @ts-expect-error - boolean is not an object
    "test",
    (s) => s,
    () => {},
  );

  subscribeTracked(
    // @ts-expect-error - boolean is not an object
    true,
    (s) => s,
    () => {},
  );
}

/**
 * Test: Should reject null and undefined.
 */
{
  subscribeTracked(
    // @ts-expect-error - null is not a valid proxy
    null,
    (s) => s,
    () => {},
  );

  subscribeTracked(
    // @ts-expect-error - undefined is not a valid proxy
    undefined,
    (s) => s,
    () => {},
  );
}

// =============================================================================
// Getter Function Tests
// =============================================================================

/**
 * Test: Getter parameter should match proxy type.
 */
{
  const state = proxy({ count: 0, name: "test" });
  subscribeTracked(
    state,
    (s) => {
      expectType<{ count: number; name: string }>(s);
      return s.count;
    },
    () => {},
  );
}

/**
 * Test: Getter can return any type.
 */
{
  const state = proxy({ count: 0, items: [1, 2, 3] });

  // Return primitive
  subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );

  // Return array
  subscribeTracked(
    state,
    (s) => s.items,
    () => {},
  );

  // Return computed value
  subscribeTracked(
    state,
    (s) => s.items.map((x) => x * 2),
    () => {},
  );

  // Return object
  subscribeTracked(
    state,
    (s) => ({ total: s.items.length }),
    () => {},
  );
}

/**
 * Test: Should handle optional chaining in getter.
 */
{
  const state = proxy({ user: null as { name: string } | null });
  subscribeTracked(
    state,
    (s) => s.user?.name,
    () => {},
  );
}

/**
 * Test: Should work with complex getter logic.
 */
{
  interface Todo {
    id: number;
    text: string;
    completed: boolean;
  }
  const state = proxy({ todos: [] as Todo[], filter: "all" });

  subscribeTracked(
    state,
    (s) => {
      return s.todos.filter((t) =>
        s.filter === "active" ? !t.completed : true,
      ).length;
    },
    () => {},
  );
}

// =============================================================================
// Callback Function Tests
// =============================================================================

/**
 * Test: Callback should be a function with no parameters.
 */
{
  const state = proxy({ count: 0 });

  // Valid callbacks
  subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
  subscribeTracked(
    state,
    (s) => s.count,
    function () {},
  );

  const callback = () => console.log("changed");
  subscribeTracked(state, (s) => s.count, callback);
}

/**
 * Test: Callback return value is ignored.
 */
{
  const state = proxy({ count: 0 });

  // Returning values is allowed but ignored
  subscribeTracked(
    state,
    (s) => s.count,
    () => 42,
  );
  subscribeTracked(
    state,
    (s) => s.count,
    () => "result",
  );
}

// =============================================================================
// Return Type Tests
// =============================================================================

/**
 * Test: Should return unsubscribe function.
 */
{
  const state = proxy({ count: 0 });
  const result = subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
  expectType<() => void>(result);
}

/**
 * Test: Unsubscribe function returns void.
 */
{
  const state = proxy({ count: 0 });
  const unsubscribe = subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
  const result = unsubscribe();
  expectType<void>(result);
}

// =============================================================================
// Generic Type Tests
// =============================================================================

/**
 * Test: Should work with generic proxy types.
 */
() => {
  function createSubscription<T extends object>(
    proxy: T,
    getter: (state: T) => unknown,
  ) {
    return subscribeTracked(proxy, getter, () => {});
  }

  const state = proxy({ count: 0 });
  const unsubscribe = createSubscription(state, (s) => s.count);
  expectType<() => void>(unsubscribe);
};

/**
 * Test: Should preserve generic constraints.
 */
() => {
  function subscribeWithConstraint<T extends { id: number }>(
    proxy: T,
    callback: () => void,
  ) {
    return subscribeTracked(proxy, (s) => s.id, callback);
  }

  const state = proxy({ id: 1, value: "test" });
  subscribeWithConstraint(state, () => {});
};

// =============================================================================
// Complex Type Tests
// =============================================================================

/**
 * Test: Should work with intersection types.
 */
{
  type Base = { id: number };
  type Extended = { name: string };
  type Combined = Base & Extended;

  const state = proxy<Combined>({ id: 1, name: "test" });
  subscribeTracked(
    state,
    (s) => s.id + s.name,
    () => {},
  );
}

/**
 * Test: Should work with union types in state.
 */
{
  type State =
    | { type: "loading" }
    | { type: "success"; data: string }
    | { type: "error"; error: Error };

  const state = proxy<{ status: State }>({ status: { type: "loading" } });
  subscribeTracked(
    state,
    (s) => s.status.type,
    () => {},
  );
}

/**
 * Test: Should work with readonly types.
 */
{
  interface ReadonlyState {
    readonly count: number;
    readonly name: string;
  }

  const state = proxy<ReadonlyState>({ count: 0, name: "test" });
  subscribeTracked(
    state,
    (s) => s.count,
    () => {},
  );
}

/**
 * Test: Should work with nested generics.
 */
{
  interface Container<T> {
    value: T;
    metadata: { created: Date };
  }

  const state = proxy<Container<string>>({
    value: "test",
    metadata: { created: new Date() },
  });

  subscribeTracked(
    state,
    (s) => s.value,
    () => {},
  );
  subscribeTracked(
    state,
    (s) => s.metadata.created,
    () => {},
  );
}

/**
 * Test: Should work with Record types.
 */
{
  const state = proxy({ map: {} as Record<string, number> });
  subscribeTracked(
    state,
    (s) => s.map["key"],
    () => {},
  );
}

/**
 * Test: Should work with Map and Set.
 */
{
  const state = proxy({
    map: new Map<string, number>(),
    set: new Set<string>(),
  });

  subscribeTracked(
    state,
    (s) => s.map.get("key"),
    () => {},
  );
  subscribeTracked(
    state,
    (s) => s.set.has("value"),
    () => {},
  );
}
