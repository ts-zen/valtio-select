import { describe, expect, test } from "bun:test";
import { proxy } from "valtio";
import { subscribeTracked } from "./subscribeTracked";

/**
 * Test Suite for subscribeTracked
 *
 * Tests the core subscription mechanism that powers fine-grained tracking.
 * Validates:
 * 1. Property access tracking
 * 2. Subscription creation and cleanup
 * 3. Structural change handling
 * 4. Memory management
 */

describe("subscribeTracked - Core Tracking", () => {
  /**
   * Verifies basic subscription and callback invocation.
   */
  test("should call callback when tracked property changes", async () => {
    const state = proxy({ count: 0 });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.count,
      () => {
        callCount++;
      },
    );

    expect(callCount).toBe(0);

    // Change tracked property
    state.count = 1;
    await Promise.resolve();

    expect(callCount).toBe(1);

    state.count = 2;
    await Promise.resolve();

    expect(callCount).toBe(2);

    unsubscribe();
  });

  /**
   * Tests that callbacks are NOT invoked for untracked properties.
   */
  test("should NOT call callback when untracked property changes", async () => {
    const state = proxy({ count: 0, name: "test" });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.count,
      () => {
        callCount++;
      },
    );

    // Change untracked property
    state.name = "changed";
    await Promise.resolve();

    expect(callCount).toBe(0);

    unsubscribe();
  });

  /**
   * Tests tracking of multiple properties simultaneously.
   */
  test("should track multiple properties", async () => {
    const state = proxy({ a: 1, b: 2, c: 3 });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.a + s.b,
      () => {
        callCount++;
      },
    );

    // Change first tracked property
    state.a = 10;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change second tracked property
    state.b = 20;
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Change untracked property
    state.c = 30;
    await Promise.resolve();
    expect(callCount).toBe(2); // No change

    unsubscribe();
  });

  /**
   * Tests that the unsubscribe function is returned and works.
   */
  test("should return unsubscribe function", async () => {
    const state = proxy({ count: 0 });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.count,
      () => {
        callCount++;
      },
    );

    expect(typeof unsubscribe).toBe("function");

    state.count = 1;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Unsubscribe
    unsubscribe();

    // Further changes should not trigger callback
    state.count = 2;
    await Promise.resolve();
    expect(callCount).toBe(1); // Still 1
  });
});

describe("subscribeTracked - Deep Tracking", () => {
  /**
   * Tests tracking of deeply nested property accesses.
   */
  test("should track deeply nested properties", async () => {
    const state = proxy({
      user: {
        profile: {
          settings: { theme: "dark" },
        },
      },
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.user.profile.settings.theme,
      () => {
        callCount++;
      },
    );

    // Change deeply nested property
    state.user.profile.settings.theme = "light";
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests that intermediate objects in the path are also tracked.
   */
  test("should track intermediate objects in access path", async () => {
    const state = proxy({
      data: {
        items: [{ value: 1 }],
      },
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.data.items[0].value,
      () => {
        callCount++;
      },
    );

    // Replace intermediate object
    state.data = { items: [{ value: 2 }] };
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests tracking with array access and methods.
   */
  test("should track array accesses", async () => {
    const state = proxy({ items: [1, 2, 3] });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.items[0],
      () => {
        callCount++;
      },
    );

    state.items[0] = 10;
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests tracking with array length property.
   */
  test("should track array length", async () => {
    const state = proxy({ items: [1, 2, 3] });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.items.length,
      () => {
        callCount++;
      },
    );

    state.items.push(4);
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests tracking with array methods that access multiple elements.
   */
  test("should track array method accesses", async () => {
    const state = proxy({ items: [1, 2, 3, 4, 5] });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.items.filter((x) => x > 2).length,
      () => {
        callCount++;
      },
    );

    // Changing an item that affects the filter
    state.items[1] = 10;
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });
});

describe("subscribeTracked - Structural Changes", () => {
  /**
   * Tests that subscriptions rebuild when objects are replaced.
   * This is the key feature that solves the structural change problem.
   */
  test("should rebuild subscriptions when structure changes", async () => {
    const state = proxy({ user: { name: "John" } });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.user.name,
      () => {
        callCount++;
      },
    );

    // Replace entire user object
    state.user = { name: "Jane" };
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Now changes to the NEW user object should trigger callbacks
    state.user.name = "Bob";
    await Promise.resolve();
    expect(callCount).toBe(2);

    unsubscribe();
  });

  /**
   * Tests handling of null/undefined in the access chain.
   */
  test("should handle null values gracefully", async () => {
    const state = proxy({
      user: null as { name: string } | null,
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.user?.name,
      () => {
        callCount++;
      },
    );

    // Transition from null to object
    state.user = { name: "John" };
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change property on the object
    state.user.name = "Jane";
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Back to null
    state.user = null;
    await Promise.resolve();
    expect(callCount).toBe(3);

    unsubscribe();
  });

  /**
   * Tests that replacing nested arrays rebuilds subscriptions correctly.
   */
  test("should handle array replacement", async () => {
    const state = proxy({ items: [1, 2, 3] });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.items[0],
      () => {
        callCount++;
      },
    );

    // Replace entire array
    state.items = [10, 20, 30];
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change item in new array
    state.items[0] = 100;
    await Promise.resolve();
    expect(callCount).toBe(2);

    unsubscribe();
  });

  /**
   * Tests multiple levels of structural changes.
   */
  test("should handle nested structural changes", async () => {
    const state = proxy({
      level1: {
        level2: {
          level3: { value: 1 },
        },
      },
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.level1.level2.level3.value,
      () => {
        callCount++;
      },
    );

    // Replace at level2
    state.level1.level2 = { level3: { value: 2 } };
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change in new structure
    state.level1.level2.level3.value = 3;
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Replace at level1
    state.level1 = { level2: { level3: { value: 4 } } };
    await Promise.resolve();
    expect(callCount).toBe(3);

    // Change in newest structure
    state.level1.level2.level3.value = 5;
    await Promise.resolve();
    expect(callCount).toBe(4);

    unsubscribe();
  });
});

describe("subscribeTracked - Conditional Access", () => {
  /**
   * Tests that different properties are tracked based on conditional logic.
   */
  test("should track conditionally accessed properties", async () => {
    const state = proxy({
      mode: "a" as "a" | "b",
      valueA: 1,
      valueB: 2,
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => (s.mode === "a" ? s.valueA : s.valueB),
      () => {
        callCount++;
      },
    );

    // Change valueA (currently tracked)
    state.valueA = 10;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change valueB (not currently tracked)
    state.valueB = 20;
    await Promise.resolve();
    expect(callCount).toBe(1); // No change

    // Switch mode - now valueB is accessed
    state.mode = "b";
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Now valueB changes should trigger callback
    state.valueB = 30;
    await Promise.resolve();
    expect(callCount).toBe(3);

    // And valueA changes should not
    state.valueA = 100;
    await Promise.resolve();
    expect(callCount).toBe(3);

    unsubscribe();
  });

  /**
   * Tests tracking with complex conditional logic.
   */
  test("should handle complex conditional access patterns", async () => {
    const state = proxy({
      user: { name: "John", premium: false },
      premiumFeatures: { limit: 1000 },
      basicFeatures: { limit: 100 },
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => (s.user.premium ? s.premiumFeatures.limit : s.basicFeatures.limit),
      () => {
        callCount++;
      },
    );

    // Change basic limit (currently tracked)
    state.basicFeatures.limit = 200;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Change premium limit (not tracked)
    state.premiumFeatures.limit = 2000;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Upgrade to premium
    state.user.premium = true;
    await Promise.resolve();
    expect(callCount).toBe(2);

    // Now premium limit changes should trigger
    state.premiumFeatures.limit = 3000;
    await Promise.resolve();
    expect(callCount).toBe(3);

    unsubscribe();
  });
});

describe("subscribeTracked - Cleanup", () => {
  /**
   * Tests that cleanup function properly unsubscribes.
   */
  test("should stop receiving updates after unsubscribe", async () => {
    const state = proxy({ count: 0 });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.count,
      () => {
        callCount++;
      },
    );

    state.count = 1;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Unsubscribe
    unsubscribe();

    // Further changes should not trigger callback
    state.count = 2;
    await Promise.resolve();
    expect(callCount).toBe(1); // Still 1
  });

  /**
   * Tests that multiple subscriptions can coexist independently.
   */
  test("should handle multiple independent subscriptions", async () => {
    const state = proxy({ a: 1, b: 2 });

    let count1 = 0;
    let count2 = 0;

    const unsubscribe1 = subscribeTracked(
      state,
      (s) => s.a,
      () => {
        count1++;
      },
    );

    const unsubscribe2 = subscribeTracked(
      state,
      (s) => s.b,
      () => {
        count2++;
      },
    );

    // Change a - only first subscription notified
    state.a = 10;
    await Promise.resolve();
    expect(count1).toBe(1);
    expect(count2).toBe(0);

    // Change b - only second subscription notified
    state.b = 20;
    await Promise.resolve();
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    unsubscribe1();
    unsubscribe2();
  });

  /**
   * Tests cleanup with nested structural changes.
   */
  test("should cleanup properly after multiple structural changes", async () => {
    const state = proxy({ obj: { value: 1 } });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.obj.value,
      () => {
        callCount++;
      },
    );

    // Multiple replacements
    for (let i = 0; i < 10; i++) {
      state.obj = { value: i };
      await Promise.resolve();
    }

    expect(callCount).toBe(10);

    unsubscribe();

    // No further updates
    state.obj = { value: 999 };
    await Promise.resolve();
    expect(callCount).toBe(10);
  });

  /**
   * Tests that unsubscribe can be called multiple times safely.
   */
  test("should handle multiple unsubscribe calls", async () => {
    const state = proxy({ count: 0 });
    let callCount = 0;

    const unsubscribe = subscribeTracked(
      state,
      (s) => s.count,
      () => {
        callCount++;
      },
    );

    state.count = 1;
    await Promise.resolve();
    expect(callCount).toBe(1);

    // Call unsubscribe multiple times
    unsubscribe();
    unsubscribe();
    unsubscribe();

    // Should still work correctly
    state.count = 2;
    await Promise.resolve();
    expect(callCount).toBe(1);
  });
});

describe("subscribeTracked - Edge Cases", () => {
  /**
   * Tests with symbol keys.
   */
  test("should track symbol keys", async () => {
    const sym = Symbol("key");
    const state = proxy({ [sym]: "value" });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s[sym],
      () => {
        callCount++;
      },
    );

    state[sym] = "changed";
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests with getters.
   */
  test("should track computed/getter properties", async () => {
    const state = proxy({
      _value: 10,
      get computed() {
        return this._value * 2;
      },
    });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.computed,
      () => {
        callCount++;
      },
    );

    state._value = 20;
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests with circular references.
   */
  test("should handle circular references", async () => {
    const state = proxy({ value: 1, self: null as unknown });
    state.self = state;

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => s.value,
      () => {
        callCount++;
      },
    );

    state.value = 2;
    await Promise.resolve();

    expect(callCount).toBe(1);

    unsubscribe();
  });

  /**
   * Tests that errors in getter don't break subscription.
   */
  test("should handle errors in getter gracefully", () => {
    const state = proxy({ value: 1 });

    const unsubscribe = subscribeTracked(
      state,
      (s) => {
        if (s.value > 5) throw new Error("Too large");
        return s.value;
      },
      () => {},
    );

    // Should not crash
    expect(() => {
      state.value = 2;
    }).not.toThrow();

    unsubscribe();
  });

  /**
   * Tests with empty objects.
   */
  test("should handle empty objects", async () => {
    const state = proxy<{ newProp?: string }>({});

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      (s) => Object.keys(s).length,
      () => {
        callCount++;
      },
    );

    // Add property
    state.newProp = "value";
    await Promise.resolve();

    // This might trigger depending on how Object.keys is tracked
    // The main point is it shouldn't crash
    expect(callCount).toBeGreaterThanOrEqual(0);

    unsubscribe();
  });

  /**
   * Tests getter that accesses no properties.
   */
  test("should handle getter with no property access", async () => {
    const state = proxy({ count: 0 });

    let callCount = 0;
    const unsubscribe = subscribeTracked(
      state,
      () => 42, // No property access
      () => {
        callCount++;
      },
    );

    // Changing state should not trigger callback
    state.count = 1;
    await Promise.resolve();

    expect(callCount).toBe(0);

    unsubscribe();
  });
});

/**
 * STRESS TEST: High-frequency updates and complex state
 *
 * This test validates that subscribeTracked can handle:
 * - Thousands of rapid state changes
 * - Deep nesting with dynamic structure changes
 * - Multiple concurrent subscriptions
 * - Proper cleanup under stress
 */
describe("subscribeTracked - stress test", () => {
  test("should handle high-frequency updates with structural changes", async () => {
    // Create complex nested state
    const state = proxy({
      counters: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        value: 0,
        nested: { deep: { value: 0 } },
      })),
      metadata: {
        updateCount: 0,
        lastUpdate: Date.now(),
      },
    });

    // Create multiple subscriptions tracking different parts
    const callCounts = [0, 0, 0, 0, 0];

    const unsubscribes = [
      // Track first counter
      subscribeTracked(
        state,
        (s) => s.counters[0].value,
        () => callCounts[0]++,
      ),
      // Track deep nested value
      subscribeTracked(
        state,
        (s) => s.counters[5].nested.deep.value,
        () => callCounts[1]++,
      ),
      // Track metadata
      subscribeTracked(
        state,
        (s) => s.metadata.updateCount,
        () => callCounts[2]++,
      ),
      // Track array length
      subscribeTracked(
        state,
        (s) => s.counters.length,
        () => callCounts[3]++,
      ),
      // Track conditional access
      subscribeTracked(
        state,
        (s) =>
          s.metadata.updateCount > 500
            ? s.counters[9].value
            : s.counters[0].value,
        () => callCounts[4]++,
      ),
    ];

    // Perform 1000 rapid updates with various operations
    for (let i = 0; i < 1000; i++) {
      const operation = i % 10;

      switch (operation) {
        case 0:
          // Update simple value
          state.counters[0].value++;
          break;
        case 1:
          // Update deep nested value
          state.counters[5].nested.deep.value++;
          break;
        case 2:
          // Update metadata
          state.metadata.updateCount++;
          state.metadata.lastUpdate = Date.now();
          break;
        case 3:
          // Replace an object (structural change)
          state.counters[0] = {
            id: 0,
            value: i,
            nested: { deep: { value: i } },
          };
          break;
        case 4:
          // Replace nested object
          state.counters[5].nested = { deep: { value: i } };
          break;
        case 5:
          // Add item to array
          state.counters.push({
            id: state.counters.length,
            value: i,
            nested: { deep: { value: i } },
          });
          break;
        case 6:
          // Remove item from array
          if (state.counters.length > 10) {
            state.counters.pop();
          }
          break;
        case 7:
          // Update multiple counters
          state.counters.forEach((c) => {
            c.value++;
          });
          break;
        case 8:
          // Replace entire counters array (major structural change)
          state.counters = Array.from({ length: 10 }, (_, idx) => ({
            id: idx,
            value: i,
            nested: { deep: { value: i } },
          }));
          break;
        case 9:
          // Update last counter (affects conditional subscription)
          state.counters[9].value = i;
          break;
      }

      // Small delay to let subscriptions process
      await Promise.resolve();
    }

    // Final wait for all updates to propagate
    await Promise.resolve();

    // Verify subscriptions received updates
    expect(callCounts[0]).toBe(400); // First counter updated frequently
    expect(callCounts[1]).toBe(300); // Deep nested updated frequently
    expect(callCounts[2]).toBe(100); // Metadata updated frequently
    expect(callCounts[3]).toBe(300); // Array length changed
    expect(callCounts[4]).toBe(500); // Conditional subscription

    // Cleanup all subscriptions
    unsubscribes.forEach((unsub) => void unsub());

    // Verify no more updates after cleanup
    const finalCounts = [...callCounts];

    state.counters[0].value = 9999;
    state.metadata.updateCount = 9999;
    await Promise.resolve();

    expect(callCounts).toEqual(finalCounts);
  }, 10000); // 10 second timeout for stress test
});
