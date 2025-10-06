import { useCallback, useMemo, useSyncExternalStore } from "react";
import { snapshot } from "valtio";
import { subscribeTracked } from "./subscribeTracked";

/**
 * A React hook that provides fine-grained subscriptions to Valtio proxies.
 *
 * This hook tracks which properties are accessed during snapshot computation
 * and subscribes only to those specific properties. When a property changes,
 * it automatically rebuilds the subscription tree to handle structural changes.
 *
 * @param proxy - The Valtio proxy object to track
 * @param getSnapshot - Function that extracts the desired data from the proxy
 * @returns The result of getSnapshot, re-computed when tracked properties change
 *
 * @example
 * ```ts
 * const state = proxy({ user: { name: 'John', age: 30 } });
 *
 * function Component() {
 *   // Only subscribes to state.user.name
 *   const name = useTrackedSnapshot(state, (s) => s.user.name);
 *   return <div>{name}</div>;
 * }
 * ```
 */
function useTrackedSnapshot<T extends object, R>(
  proxy: T,
  getSnapshot: (proxy: T) => R,
): R {
  // Create subscription function using subscribeTracked
  // Memoized to prevent recreation on every render
  const subscribe = useCallback(
    (callback: () => void) => subscribeTracked(proxy, getSnapshot, callback),
    [proxy, getSnapshot],
  );

  // Use React's useSyncExternalStore for proper subscription handling
  const value = useSyncExternalStore(
    subscribe,
    () => getSnapshot(proxy),
    () => getSnapshot(proxy),
  );

  // Return snapshot of the value to ensure immutability
  return useMemo<R>(
    () =>
      typeof value === "object" && value !== null
        ? (snapshot(value) as R)
        : value,
    [value],
  );
}

export { useTrackedSnapshot };
