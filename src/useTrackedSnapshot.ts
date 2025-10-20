import { useCallback, useSyncExternalStore } from "react";
import { useSnapshot } from "valtio";
import { subscribeTracked } from "./subscribeTracked";
import { isValtioProxy, noopProxy } from "./utils";

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

  if (process.env.NODE_ENV !== "production") {
    // "getSnapshot" should be able to recognize that the snapshot has not
    // changed. The instability of the snapshot will likely cause an infinite
    // render loop.
    if (!Object.is(getSnapshot(proxy), getSnapshot(proxy))) {
      console.warn(
        '"getSnapshot" must be a pure function, and if called multiple times ' +
          "in a row, it must return the same snapshot. This is necessary to " +
          "avoid an infinite render loop:\n\n" +
          "// This is problematic:\n" +
          'const snapshot: Value = useTrackedSnapshot(proxy, (p) => p.prop || ["defaultUnstableValue"]);\n\n' +
          "// This will correctly maintain stability:\n" +
          "const maybeSnapshot: Value | undefined = useTrackedSnapshot(proxy, (p) => p.prop]);\n" +
          'const snapshot = useMemo(() => maybeSnapshot ?? ["defaultUnstableValue"], [maybeSnapshot]);\n',
      );
    }
  }

  // Compute the snapshot if necessary.
  const snapshot = useSnapshot(isValtioProxy(value) ? value : noopProxy) as R;

  // Return the snapshot of the actual plain value.
  return isValtioProxy(value) ? snapshot : value;
}

export { useTrackedSnapshot };
