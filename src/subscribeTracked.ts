import { subscribeKey } from "valtio/utils";

/**
 * Creates a subscription to a Valtio proxy that tracks property accesses
 * and subscribes only to those properties. When any tracked property changes,
 * it automatically rebuilds subscriptions to handle structural changes.
 *
 * API matches Valtio's subscribe pattern: subscribeTracked(proxy, getter, callback)
 *
 * @param proxy - The Valtio proxy object to track
 * @param getter - Function that accesses properties on the proxy
 * @param callback - Function to call when tracked properties change
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * const state = proxy({ user: { name: 'John' } });
 * const unsubscribe = subscribeTracked(
 *   state,
 *   (s) => s.user.name,
 *   () => console.log('Name changed!')
 * );
 * ```
 */
export function subscribeTracked<T extends object>(
  proxy: T,
  getter: (proxy: T) => unknown,
  callback: () => void,
): () => void {
  // Unsubscribes callbacks.
  const unsubs: Array<() => void> = [];
  // IsTracking flag.
  const isTracking = { current: true };

  /**
   * Creates a tracking proxy that records all property accesses.
   *
   * When a property is accessed, it calls the onAccess callback with the
   * object and property key. Nested objects are recursively wrapped to
   * track deep property access chains.
   *
   * @param target - Object to wrap with tracking
   * @param onAccess - Callback invoked for each property access
   * @param isTracking - Ref object controlling whether tracking is active
   * @returns Proxy that tracks property accesses
   */
  function createTracker<TTarget extends object>(
    target: TTarget,
    onAccess: (obj: object, key: string | symbol) => void,
  ): TTarget {
    return new Proxy(target, {
      get(obj, prop) {
        // Record access only when tracking is enabled
        if (isTracking.current) {
          onAccess(obj, prop);
        }

        // Get the actual value
        const value = obj[prop as keyof typeof obj];

        // Recursively wrap nested objects to track deep accesses
        if (isTracking.current && value && typeof value === "object") {
          return createTracker(value, onAccess);
        }

        return value;
      },
    }) as TTarget;
  }

  /**
   * Runs the getter with tracking enabled to discover which properties
   * are accessed. Returns a map of objects to their accessed properties.
   *
   * @returns Map where keys are objects and values are sets of accessed keys
   */
  function trackAccesses(): Map<object, Set<string | symbol>> {
    const accesses = new Map<object, Set<string | symbol>>();

    try {
      isTracking.current = true;
      // Create tracking proxy and run getter
      const tracked = createTracker(proxy, (obj, key) => {
        let keys = accesses.get(obj);
        if (!keys) {
          keys = new Set();
          accesses.set(obj, keys);
        }
        keys.add(key);
      });

      getter(tracked as T);
    } finally {
      isTracking.current = false;
    }

    return accesses;
  }

  /**
   * Clears all active subscriptions.
   */
  function cleanup() {
    unsubs.forEach((unsub) => void unsub());
    unsubs.length = 0;
  }

  /**
   * Sets up subscriptions based on current property accesses.
   * Rebuilds subscriptions on each call to handle structural changes.
   */
  function setupSubscriptions() {
    cleanup();

    const accesses = trackAccesses();

    // Subscribe to each tracked property
    accesses.forEach((keys, obj) => {
      keys.forEach((key) => {
        const unsub = subscribeKey(obj, key as keyof typeof obj, () => {
          // On change: rebuild subscriptions and notify
          setupSubscriptions();
          callback();
        });
        unsubs.push(unsub);
      });
    });
  }

  // Setup the initial subscription.
  setupSubscriptions();

  // Returns the cleanup function.
  return cleanup;
}
