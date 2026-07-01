export type Cleanup = () => void;
export type OnAdd = (el: HTMLElement) => Cleanup | undefined | void;

export interface WatchOptions {
  /** Root to observe. Defaults to document.body ?? document.documentElement. */
  root?: ParentNode;
}

/**
 * Watch for elements matching `selector` appearing anywhere under `root`.
 * `onAdd` fires once per element when it (or an inserted ancestor) enters the
 * DOM. If `onAdd` returns a function, it runs when that element is later
 * removed. Returns a stop function that disconnects the observer and runs all
 * pending cleanups.
 *
 * Only HTMLElements are considered — text nodes, comments, and SVG elements are
 * ignored, so mixed/non-HTML content never breaks matching. A single
 * MutationObserver on childList+subtree drives everything; a WeakMap keeps
 * per-element cleanups and makes repeated mutations idempotent, and a Set of
 * live elements lets stop() run every pending cleanup.
 */
export function watch(
  selector: string,
  onAdd: OnAdd,
  options: WatchOptions = {},
): () => void {
  // cleanups: per-element cleanup + dedup guard (a WeakMap never leaks even if
  // an element is removed without a mutation record). live: the currently
  // tracked elements, so stop() can clean them all — including any relocated
  // outside root, which a re-scan would miss. Every element is removed from
  // live the moment its cleanup runs, so it only ever holds the live set.
  const cleanups = new WeakMap<HTMLElement, Cleanup | null>();
  const live = new Set<HTMLElement>();
  const root = options.root ?? document.body ?? document.documentElement;

  const runOnAdd = (el: HTMLElement): void => {
    if (cleanups.has(el)) return;
    let cleanup: Cleanup | null = null;
    try {
      cleanup = onAdd(el) ?? null;
    } catch (error) {
      console.error("[shared/watch] onAdd threw", error);
      cleanup = null;
    }
    cleanups.set(el, cleanup);
    live.add(el);
  };

  const runCleanup = (el: HTMLElement): void => {
    if (!cleanups.has(el)) return;
    const cleanup = cleanups.get(el);
    cleanups.delete(el);
    live.delete(el);
    if (cleanup) {
      try {
        cleanup();
      } catch (error) {
        console.error("[shared/watch] cleanup threw", error);
      }
    }
  };

  const handleAdded = (node: Node): void => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(selector)) runOnAdd(node);
    for (const el of node.querySelectorAll(selector)) {
      if (el instanceof HTMLElement) runOnAdd(el);
    }
  };

  const handleRemoved = (node: Node): void => {
    if (!(node instanceof HTMLElement)) return;
    // runCleanup is a no-op for untracked elements, so no self-check needed.
    runCleanup(node);
    for (const el of node.querySelectorAll(selector)) {
      if (el instanceof HTMLElement) runCleanup(el);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) handleAdded(node);
      for (const node of record.removedNodes) handleRemoved(node);
    }
  });

  observer.observe(root, { childList: true, subtree: true });

  // Initial synchronous scan of already-present matches. When root is an
  // HTMLElement, handleAdded covers it plus its descendants; otherwise (a rare
  // non-HTMLElement ParentNode such as a DocumentFragment) scan its descendants
  // directly, since only HTMLElements are ever passed to onAdd.
  if (root instanceof HTMLElement) {
    handleAdded(root);
  } else {
    for (const el of root.querySelectorAll(selector)) {
      if (el instanceof HTMLElement) runOnAdd(el);
    }
  }

  return () => {
    observer.disconnect();
    // Run every pending cleanup. Iterating a copy because runCleanup mutates
    // `live` during the loop.
    for (const el of [...live]) runCleanup(el);
  };
}
