import { describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { proxy } from "valtio";
import { useTrackedSnapshot } from "./useTrackedSnapshot";

/**
 * Test Suite for useTrackedSnapshot
 *
 * This suite validates the core functionality of fine-grained subscriptions
 * to Valtio proxies, ensuring that:
 * 1. Only accessed properties trigger re-renders
 * 2. Structural changes properly rebuild subscriptions
 * 3. Deep nesting and optional chaining work correctly
 * 4. Edge cases are handled gracefully
 * 5. No memory leaks or performance issues
 */

describe("useTrackedSnapshot - Basic Functionality", () => {
  /**
   * Tests that the hook correctly tracks simple property accesses
   * and returns the expected value.
   *
   * Why this matters: Basic functionality is the foundation - if this fails,
   * nothing else will work.
   */
  test("should return the correct value from selector", () => {
    const state = proxy({ count: 0, name: "Test" });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.count),
    );

    expect(result.current).toBe(0);
  });

  /**
   * Tests that changing a tracked property triggers a re-render.
   *
   * Why this matters: This is the core purpose of the hook - ensuring
   * components stay in sync with the state they depend on.
   */
  test("should re-render when tracked property changes", async () => {
    const state = proxy({ count: 0 });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useTrackedSnapshot(state, (s) => s.count);
    });

    expect(renderCount).toBe(1);
    expect(result.current).toBe(0);

    // Trigger a change to the tracked property
    act(() => {
      state.count = 1;
    });

    await waitFor(() => {
      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
    });
  });

  /**
   * Tests that changing an untracked property does NOT trigger a re-render.
   *
   * Why this matters: This validates the fine-grained subscription mechanism.
   * Only tracking accessed properties is what makes this hook efficient and
   * prevents unnecessary re-renders.
   */
  test("should NOT re-render when untracked property changes", async () => {
    const state = proxy({ count: 0, name: "Test" });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      // Only tracking 'count', not 'name'
      return useTrackedSnapshot(state, (s) => s.count);
    });

    expect(renderCount).toBe(1);

    // Change untracked property
    act(() => {
      state.name = "Changed";
    });

    // Wait a bit to ensure no re-render happens
    await Promise.resolve();

    expect(renderCount).toBe(1); // Should still be 1
    expect(result.current).toBe(0);
  });

  /**
   * Tests that multiple properties can be tracked simultaneously.
   *
   * Why this matters: Real applications often need multiple pieces of state.
   * This ensures the tracking mechanism works with complex selectors.
   */
  test("should track multiple properties", async () => {
    const state = proxy({ age: 30, firstName: "John", lastName: "Doe" });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useTrackedSnapshot(state, (s) => `${s.firstName} ${s.lastName}`);
    });

    expect(result.current).toBe("John Doe");
    expect(renderCount).toBe(1);

    // Change first tracked property
    act(() => {
      state.firstName = "Jane";
    });

    await waitFor(() => {
      expect(renderCount).toBe(2);
      expect(result.current).toBe("Jane Doe");
    });

    // Change second tracked property
    act(() => {
      state.lastName = "Smith";
    });

    await waitFor(() => {
      expect(renderCount).toBe(3);
      expect(result.current).toBe("Jane Smith");
    });

    // Change untracked property
    act(() => {
      state.age = 31;
    });

    await Promise.resolve();
    expect(renderCount).toBe(3); // No additional render
  });

  /**
   * Tests that computed values work correctly.
   *
   * Why this matters: Selectors often perform transformations or calculations.
   * The hook must preserve these computations while still tracking dependencies.
   */
  test("should handle computed values", async () => {
    const state = proxy({ items: [1, 2, 3], multiplier: 2 });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) =>
        s.items.reduce((acc, item) => acc + item * s.multiplier, 0),
      ),
    );

    expect(result.current).toEqual(12);

    act(() => {
      state.multiplier = 3;
    });

    await waitFor(() => {
      expect(result.current).toEqual(18);
    });
  });
});

describe("useTrackedSnapshot - Deep Tracking", () => {
  /**
   * Tests that deeply nested property accesses are tracked correctly.
   *
   * Why this matters: Real applications often have deeply nested state.
   * The recursive tracking proxy must handle arbitrary nesting depth.
   */
  test("should track deeply nested properties", async () => {
    const state = proxy({
      user: {
        profile: {
          settings: {
            notifications: true,
            theme: "dark",
          },
        },
      },
    });

    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useTrackedSnapshot(state, (s) => s.user.profile.settings.theme);
    });

    expect(result.current).toBe("dark");
    expect(renderCount).toBe(1);

    // Change the deeply nested tracked property
    act(() => {
      state.user.profile.settings.theme = "light";
    });

    await waitFor(() => {
      expect(renderCount).toBe(2);
      expect(result.current).toBe("light");
    });

    // Change a sibling property at the same level (should not re-render)
    act(() => {
      state.user.profile.settings.notifications = false;
    });

    await Promise.resolve();
    expect(renderCount).toBe(2); // Still 2
  });

  /**
   * Tests that arrays are properly tracked.
   *
   * Why this matters: Arrays are objects too, but they have special behaviors
   * (indexed access, array methods). The tracking mechanism must handle both
   * array-specific and object-like access patterns.
   */
  test("should track array properties", async () => {
    const state = proxy({ todos: [{ done: false, text: "Buy milk" }] });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.todos[0]?.text),
    );

    expect(result.current).toBe("Buy milk");

    act(() => {
      state.todos[0].text = "Buy bread";
    });

    await waitFor(() => {
      expect(result.current).toBe("Buy bread");
    });
  });

  /**
   * Tests tracking with nested arrays.
   *
   * Why this matters: Matrix-like structures are common (e.g., grids, tables).
   * The hook must handle arrays within arrays correctly.
   */
  test("should track nested arrays", async () => {
    const state = proxy({
      matrix: [
        [1, 2],
        [3, 4],
      ],
    });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.matrix[0][1]),
    );

    expect(result.current).toBe(2);

    act(() => {
      state.matrix[0][1] = 99;
    });

    await waitFor(() => {
      expect(result.current).toBe(99);
    });
  });

  /**
   * Tests that optional chaining doesn't break tracking.
   *
   * Why this matters: Optional chaining is essential for safely accessing
   * potentially undefined nested properties. The tracking proxy must handle
   * undefined values without throwing errors.
   */
  test("should handle optional chaining gracefully", () => {
    const state = proxy({ user: null as { name: string } | null });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.user?.name),
    );

    expect(result.current).toBeUndefined();

    // This shouldn't throw
    act(() => {
      state.user = { name: "John" };
    });
  });

  /**
   * Tests that different paths through the same object are tracked independently.
   *
   * Why this matters: A component might access the same object through different
   * paths (e.g., state.items[0].id and state.activeItem.id where they reference
   * the same object). Each access path should be tracked separately.
   */
  test("should track different access paths to same object", async () => {
    const sharedObj = { value: 0 };
    const state = proxy({ a: sharedObj, b: sharedObj });

    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      // Only accessing through 'a' path
      return useTrackedSnapshot(state, (s) => s.a.value);
    });

    expect(result.current).toBe(0);

    // Change through the tracked path
    act(() => {
      state.a.value = 1;
    });

    await waitFor(() => {
      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
    });
  });
});

describe("useTrackedSnapshot - Structural Changes", () => {
  /**
   * Tests that replacing an entire object triggers re-subscription.
   *
   * Why this matters: This is THE critical feature that solves the main problem
   * with useSnapshot. When an object is replaced, components must re-subscribe
   * to the new object, not keep listening to the old one.
   */
  test("should rebuild subscriptions when object is replaced", async () => {
    const state = proxy({ user: { age: 30, name: "John" } });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.user.name),
    );

    expect(result.current).toBe("John");

    // Replace the entire user object
    act(() => {
      state.user = { age: 25, name: "Jane" };
    });

    await waitFor(() => {
      expect(result.current).toBe("Jane");
    });

    // Now change a property on the NEW object
    act(() => {
      state.user.name = "Bob";
    });

    await waitFor(() => {
      expect(result.current).toBe("Bob");
    });
  });

  /**
   * Tests handling of null and undefined values.
   *
   * Why this matters: One of the main problems this hook solves is working
   * with nullable state. It must handle transitions between null/undefined
   * and objects gracefully.
   */
  test("should handle null and undefined values", async () => {
    const state = proxy({
      user: null as { name: string } | null,
    });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.user?.name ?? "Guest"),
    );

    expect(result.current).toBe("Guest");

    // Transition from null to object
    act(() => {
      state.user = { name: "John" };
    });

    await waitFor(() => {
      expect(result.current).toBe("John");
    });

    // Transition back to null
    act(() => {
      state.user = null;
    });

    await waitFor(() => {
      expect(result.current).toBe("Guest");
    });
  });

  /**
   * Tests that adding new properties works correctly.
   *
   * Why this matters: State shape can change dynamically. The hook must adapt
   * to new properties being added to tracked objects.
   */
  test("should handle dynamic property addition", async () => {
    const state = proxy<{ count: number; newProp?: string }>({ count: 0 });

    const { result, rerender } = renderHook(
      ({ selector }) => useTrackedSnapshot(state, selector),
      {
        initialProps: {
          selector: (s: typeof state) => s.count as number | string | undefined,
        },
      },
    );

    expect(result.current).toBe(0);

    // Add a new property
    act(() => {
      state.newProp = "hello";
    });

    // Change selector to access new property
    rerender({
      selector: (s: typeof state) => s.newProp,
    });

    await waitFor(() => {
      expect(result.current).toBe("hello");
    });

    // Modify the new property
    act(() => {
      state.newProp = "world";
    });

    await waitFor(() => {
      expect(result.current).toBe("world");
    });
  });

  /**
   * Tests that deleting properties is handled correctly.
   *
   * Why this matters: Properties can be removed from objects. Subscriptions
   * to deleted properties must be cleaned up properly to avoid memory leaks.
   */
  test("should handle property deletion", async () => {
    const state = proxy({ a: 1, b: 2 as 2 | undefined });

    const { result } = renderHook(() => useTrackedSnapshot(state, (s) => s.b));

    expect(result.current).toBe(2);

    act(() => {
      delete state.b;
    });

    await waitFor(() => {
      expect(result.current).toBeUndefined();
    });
  });

  /**
   * Tests structural changes in nested objects.
   *
   * Why this matters: Structural changes can happen at any level of nesting.
   * The re-subscription mechanism must work recursively.
   */
  test("should handle nested structural changes", async () => {
    const state = proxy({
      data: {
        items: [{ id: 1, value: "a" }],
      },
    });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.data.items[0]?.value),
    );

    expect(result.current).toBe("a");

    // Replace the items array
    act(() => {
      state.data.items = [{ id: 2, value: "b" }];
    });

    await waitFor(() => {
      expect(result.current).toBe("b");
    });

    // Now modify the new array's item
    act(() => {
      state.data.items[0].value = "c";
    });

    await waitFor(() => {
      expect(result.current).toBe("c");
    });
  });
});

describe("useTrackedSnapshot - Edge Cases", () => {
  /**
   * Tests behavior with empty objects.
   *
   * Why this matters: Empty objects are valid state. The hook must handle
   * them without errors, even though no properties are accessed.
   */
  test("should handle empty objects", () => {
    const state = proxy({});

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => Object.keys(s).length),
    );

    expect(result.current).toBe(0);
  });

  /**
   * Tests that symbols can be used as property keys.
   *
   * Why this matters: JavaScript allows symbols as object keys, and some
   * libraries use them (e.g., for metadata). The tracking mechanism must
   * handle symbol keys correctly.
   */
  test("should handle symbols as keys", async () => {
    const sym = Symbol("test");
    const state = proxy({ [sym]: "value" });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s[sym]),
    );

    expect(result.current).toBe("value");

    act(() => {
      state[sym] = "changed";
    });

    await waitFor(() => {
      expect(result.current).toBe("changed");
    });
  });

  /**
   * Tests selector functions that access getters/computed properties.
   *
   * Why this matters: Objects can have computed properties via getters.
   * These should be tracked just like regular properties.
   */
  test("should handle computed/getter properties", async () => {
    const state = proxy({
      _value: 10,
      get doubled() {
        return this._value * 2;
      },
    });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.doubled),
    );

    expect(result.current).toBe(20);

    act(() => {
      state._value = 20;
    });

    await waitFor(() => {
      expect(result.current).toBe(40);
    });
  });

  /**
   * Tests that multiple components can use different selectors on the same proxy.
   *
   * Why this matters: In real applications, many components will access the
   * same state with different selectors. Each must maintain independent
   * subscriptions without interfering with each other.
   */
  test("should support multiple components with different selectors", async () => {
    const state = proxy({ a: 1, b: 2, c: 3 });

    let renderCount1 = 0;
    let renderCount2 = 0;

    // Component 1 tracks 'a'
    const { result: result1 } = renderHook(() => {
      renderCount1++;
      return useTrackedSnapshot(state, (s) => s.a);
    });

    // Component 2 tracks 'b'
    const { result: result2 } = renderHook(() => {
      renderCount2++;
      return useTrackedSnapshot(state, (s) => s.b);
    });

    expect(result1.current).toBe(1);
    expect(result2.current).toBe(2);
    expect(renderCount1).toBe(1);
    expect(renderCount2).toBe(1);

    // Change 'a' - should only affect component 1
    act(() => {
      state.a = 10;
    });

    await waitFor(() => {
      expect(renderCount1).toBe(2);
      expect(renderCount2).toBe(1); // Unchanged
      expect(result1.current).toBe(10);
    });

    // Change 'b' - should only affect component 2
    act(() => {
      state.b = 20;
    });

    await waitFor(() => {
      expect(renderCount1).toBe(2); // Unchanged
      expect(renderCount2).toBe(2);
      expect(result2.current).toBe(20);
    });
  });

  /**
   * Tests that circular references don't cause infinite loops.
   *
   * Why this matters: Circular references are common in graph-like structures.
   * The recursive tracking proxy must detect and handle cycles.
   */
  test("should handle circular references", () => {
    const state = proxy({ self: null as unknown, value: 1 });
    state.self = state;

    // This should not cause infinite recursion
    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.value),
    );

    expect(result.current).toBe(1);

    act(() => {
      state.value = 2;
    });
  });

  /**
   * Tests rapid concurrent updates.
   *
   * Why this matters: In real applications, state can change rapidly
   * (e.g., during animations, data streaming). The hook must handle
   * batched/concurrent updates without losing data or causing errors.
   */
  test("should handle rapid concurrent updates", async () => {
    const state = proxy({ count: 0 });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.count),
    );

    // Trigger multiple rapid updates
    act(() => {
      for (let i = 1; i <= 10; i++) {
        state.count = i;
      }
    });

    await waitFor(() => {
      expect(result.current).toBe(10);
    });
  });

  /**
   * Tests selector functions that conditionally access properties.
   *
   * Why this matters: Selectors often have conditional logic (if/else, ternary).
   * The tracking mechanism must handle cases where different properties are
   * accessed on different renders.
   */
  test("should handle conditional property access", async () => {
    const state = proxy({ mode: "a" as "a" | "b", valueA: 1, valueB: 2 });

    const { result } = renderHook(() =>
      useTrackedSnapshot(state, (s) => (s.mode === "a" ? s.valueA : s.valueB)),
    );

    // Initially accessing valueA
    expect(result.current).toBe(1);

    // Change valueA (tracked)
    act(() => {
      state.valueA = 10;
    });

    await waitFor(() => {
      expect(result.current).toBe(10);
    });

    // Change valueB (not currently tracked)
    act(() => {
      state.valueB = 20;
    });

    await Promise.resolve();
    expect(result.current).toBe(10); // Should not change

    // Switch mode - now tracking valueB instead
    act(() => {
      state.mode = "b";
    });

    await waitFor(() => {
      expect(result.current).toBe(20);
    });

    // Change valueB (now tracked)
    act(() => {
      state.valueB = 30;
    });

    await waitFor(() => {
      expect(result.current).toBe(30);
    });

    // Change valueA (no longer tracked)
    act(() => {
      state.valueA = 100;
    });

    await Promise.resolve();
    expect(result.current).toBe(30); // Should not change
  });
});

describe("useTrackedSnapshot - Performance & Cleanup", () => {
  /**
   * Tests that subscriptions are properly cleaned up on unmount.
   *
   * Why this matters: Memory leaks are a critical bug. When a component
   * unmounts, all its subscriptions must be cleaned up to prevent the
   * component from staying in memory.
   */
  test("should unsubscribe when component unmounts", async () => {
    const state = proxy({ count: 0 });
    let renderCount = 0;

    const { unmount } = renderHook(() => {
      renderCount++;
      return useTrackedSnapshot(state, (s) => s.count);
    });

    expect(renderCount).toBe(1);

    // Unmount the component
    unmount();

    // Change state after unmount
    act(() => {
      state.count = 1;
    });

    // Wait to ensure no render occurred
    await Promise.resolve();

    // Render count should still be 1 (no render after unmount)
    expect(renderCount).toBe(1);
  });

  /**
   * Tests that changing the selector function updates subscriptions.
   *
   * Why this matters: If the selector function changes (e.g., due to
   * changing dependencies), the hook must re-establish subscriptions
   * based on the new selector.
   */
  test("should update subscriptions when selector changes", async () => {
    const state = proxy({ a: 1, b: 2 });
    let renderCount = 0;

    const { result, rerender } = renderHook(
      ({ selector }) => {
        renderCount++;
        return useTrackedSnapshot(state, selector);
      },
      {
        initialProps: {
          selector: (s: typeof state) => s.a,
        },
      },
    );

    expect(result.current).toBe(1);
    expect(renderCount).toBe(1);

    // Change selector to track 'b' instead of 'a'
    rerender({
      selector: (s: typeof state) => s.b,
    });

    await waitFor(() => {
      expect(result.current).toBe(2);
      expect(renderCount).toBe(2);
    });

    // Change 'a' - should not trigger render anymore
    act(() => {
      state.a = 10;
    });

    await Promise.resolve();
    expect(renderCount).toBe(2);

    // Change 'b' - should trigger render now
    act(() => {
      state.b = 20;
    });

    await waitFor(() => {
      expect(result.current).toBe(20);
      expect(renderCount).toBe(3);
    });
  });

  /**
   * Tests that the hook doesn't create excessive re-renders.
   *
   * Why this matters: Performance is critical. The hook should only
   * re-render when absolutely necessary - when tracked data changes.
   */
  test("should not cause excessive re-renders", async () => {
    const state = proxy({
      items: [{ id: 1 }, { id: 2 }, { id: 3 }] as Array<{
        id: number;
        value?: string;
      }>,
    });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useTrackedSnapshot(state, (s) => s.items.length);
    });

    expect(result.current).toBe(3);
    expect(renderCount).toBe(1);

    // Modify item properties (not tracked)
    act(() => {
      state.items[0].value = "test";
      state.items[1].value = "test";
      state.items[2].value = "test";
    });

    await Promise.resolve();
    expect(renderCount).toBe(1); // No re-renders

    // Change array length (tracked)
    act(() => {
      state.items.push({ id: 4 });
    });

    await waitFor(() => {
      expect(renderCount).toBe(2); // One re-render
      expect(result.current).toBe(4);
    });
  });

  /**
   * Tests memory cleanup with long-lived subscriptions.
   *
   * Why this matters: Long-running applications must not accumulate memory.
   * Subscriptions must be properly garbage collected when no longer needed.
   */
  test("should properly clean up subscriptions over multiple updates", async () => {
    const state = proxy({ value: 0 });

    const { result, unmount } = renderHook(() =>
      useTrackedSnapshot(state, (s) => s.value),
    );

    // Perform many updates to test cleanup
    for (let i = 0; i <= 100; i++) {
      act(() => {
        state.value = i;
      });

      await Promise.resolve();
      await Promise.resolve();
      expect(result.current).toBe(i);
    }

    // Unmount should clean everything up
    unmount();

    // This is more of a smoke test - actual memory leak testing
    // would require profiling tools, but at least we verify
    // no errors occur during extensive use
  });
});
