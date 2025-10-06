import { getVersion, proxy } from "valtio";

/**
 * Utility to check if a value is a Valtio proxy.
 * https://github.com/pmndrs/valtio/discussions/473#discussioncomment-2946892
 */
export const isValtioProxy = (obj: unknown): obj is object => {
  return typeof getVersion(obj) === "number";
};

// Proxy used for noop.
export const noopProxy = proxy({});
