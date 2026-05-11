// Import a component into a target element
// Import a component and recursively load its nested components
// Returns the parsed document for additional processing

// cache object to store loaded components (memory cache)
const componentCache = {};

// Lock map to prevent multiple simultaneous imports of the same component
const importLocks = new Map();

// Generate cache name from version
const CACHE_NAME = 'components-cache-' + (globalThis.APP_VERSION || 'dev');

// Clean up old caches on load
(async () => {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    // Delete caches that don't match current version
    await Promise.all(
      keys.map(key => {
        if (key.startsWith('components-cache-') && key !== CACHE_NAME) {
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      })
    );
  } catch (e) {
    console.warn('Error cleaning caches:', e);
  }
})();

export async function importComponent(path, targetElement) {
  // Create a unique key for this import based on the target element
  const lockKey = targetElement.id || targetElement.getAttribute('data-component-id') || targetElement;

  // If this component is already being loaded, return early
  if (importLocks.get(lockKey)) {
    // console.log(`Component ${path} is already being loaded for target`, targetElement); // Reduce noise
    return;
  }

  // Set the lock
  importLocks.set(lockKey, true);

  try {
    if (!targetElement) {
      throw new Error("Target element is required");
    }

    // Show loading indicator
    targetElement.innerHTML = '<div class="loading"></div>';

    // full component url
    const componentUrl = path.startsWith("/") ? path : (path.startsWith("components/") ? path : "components/" + path);

    // get html from memory cache, persistent cache, or fetch it
    let html;

    // 1. Check Memory Cache
    if (componentCache[componentUrl]) {
      html = componentCache[componentUrl];
    } else {
      // 2. Check Persistent Cache (if available)
      let cacheHit = false;
      if ('caches' in window) {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(componentUrl);
          if (cachedResponse) {
            html = await cachedResponse.text();
            componentCache[componentUrl] = html; // Update memory cache
            cacheHit = true;
          }
        } catch (e) {
          console.warn('Cache match error:', e);
        }
      }

      // 3. Network Fetch
      if (!cacheHit) {
        const response = await fetch(componentUrl);
        if (!response.ok) {
          throw new Error(
            `Error loading component ${path}: ${response.statusText}`
          );
        }
        html = await response.text();

        // Store in memory cache
        componentCache[componentUrl] = html;

        // Store in persistent cache
        if ('caches' in window) {
          try {
            const cache = await caches.open(CACHE_NAME);
            // Clone response to put in cache (though we already consumed text, so we put new Response)
            await cache.put(componentUrl, new Response(html, {
              headers: { 'Content-Type': 'text/html' }
            }));
          } catch (e) {
            // ignore cache put errors
          }
        }
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Separate nodes into styles, scripts, and body nodes to ensure correct loading order
    // and avoid duplicates caused by doc.body.childNodes containing styles/scripts.
    const styles = Array.from(doc.querySelectorAll("style, link[rel='stylesheet']"));
    const scripts = Array.from(doc.querySelectorAll("script"));

    // Get body nodes but filter out scripts and styles to avoid duplication
    const bodyNodes = Array.from(doc.body.childNodes).filter(node =>
      !scripts.includes(node) && !styles.includes(node)
    );

    // Order: styles first (for FOUC), then HTML, then scripts last
    const allNodes = [
      ...styles,
      ...bodyNodes,
      ...scripts,
    ];

    const loadPromises = [];
    const deferredNodes = [];
    let blobCounter = 0;

    for (const node of allNodes) {
      if (node.nodeName === "SCRIPT") {
        const isModule =
          node.type === "module" || node.getAttribute("type") === "module";

        if (isModule) {
          if (node.src) {
            // For <script type="module" src="..." use dynamic import
            const resolvedUrl = new URL(
              node.src,
              globalThis.location.origin
            ).toString();

            // Check if module is already in cache (we track promises)
            // Note: Modules are cached by browser engine automatically, so we just await import
            if (!componentCache[resolvedUrl]) {
              const modulePromise = import(resolvedUrl);
              componentCache[resolvedUrl] = modulePromise;
              loadPromises.push(modulePromise);
            }
          } else {
            const virtualUrl = `${componentUrl.replaceAll(
              "/",
              "_"
            )}.${++blobCounter}.js`;

            // For inline module scripts, use cache or create blob
            if (!componentCache[virtualUrl]) {
              // Transform relative import paths to absolute URLs
              let content = node.textContent.replace(
                /import\s+([^'"]+)\s+from\s+["']([^"']+)["']/g,
                (match, bindings, importPath) => {
                  // Convert relative OR root-based (e.g. /src/...) to absolute URLs
                  if (!/^https?:\/\//.test(importPath)) {
                    const absoluteUrl = new URL(
                      importPath,
                      globalThis.location.origin
                    ).href;
                    return `import ${bindings} from "${absoluteUrl}"`;
                  }
                  return match;
                }
              );

              // Add sourceURL to the content
              content += `\n//# sourceURL=${virtualUrl}`;

              // Create a Blob from the rewritten content
              const blob = new Blob([content], {
                type: "text/javascript",
              });
              const blobUrl = URL.createObjectURL(blob);

              const modulePromise = import(blobUrl)
                .catch((err) => {
                  console.error(`Failed to load inline module ${virtualUrl}:`, err);
                  throw err;
                })
                .finally(() => URL.revokeObjectURL(blobUrl));

              componentCache[virtualUrl] = modulePromise;
              loadPromises.push(modulePromise);
            }
          }
        } else {
          // Non-module script
          const script = document.createElement("script");
          Array.from(node.attributes || []).forEach((attr) => {
            script.setAttribute(attr.name, attr.value);
          });
          script.textContent = node.textContent;

          if (script.src) {
            const promise = new Promise((resolve, reject) => {
              script.onload = resolve;
              script.onerror = reject;
            });
            loadPromises.push(promise);
          }

          targetElement.appendChild(script);
        }
      } else if (
        node.nodeName === "STYLE" ||
        (node.nodeName === "LINK" && node.rel === "stylesheet")
      ) {
        const clone = node.cloneNode(true);

        if (clone.tagName === "LINK" && clone.rel === "stylesheet") {
          const promise = new Promise((resolve, reject) => {
            clone.onload = resolve;
            clone.onerror = reject;
          });
          loadPromises.push(promise);
        }

        targetElement.appendChild(clone);
      } else {
        deferredNodes.push(node.cloneNode(true));
      }
    }

    // Wait for all tracked external scripts/styles to finish loading
    await Promise.all(loadPromises);

    for (const deferred of deferredNodes) {
      targetElement.appendChild(deferred);
    }

    // Remove loading indicator
    const loadingEl = targetElement.querySelector(':scope > .loading');
    if (loadingEl) {
      targetElement.removeChild(loadingEl);
    }

    // // Load any nested components
    // await loadComponents([targetElement]);

    // Return parsed document
    return doc;
  } catch (error) {
    console.error("Error importing component:", error);
    throw error;
  } finally {
    // Release the lock when done, regardless of success or failure
    importLocks.delete(lockKey);
  }
}

// Load all x-component tags starting from root elements
export async function loadComponents(roots = [document.documentElement]) {
  try {
    // Convert single root to array if needed
    const rootElements = Array.isArray(roots) ? roots : [roots];

    // Find all top-level components and load them in parallel
    const components = rootElements.flatMap((root) =>
      Array.from(root.querySelectorAll("x-component"))
    );

    if (components.length === 0) return;

    await Promise.all(
      components.map(async (component) => {
        const path = component.getAttribute("path");
        if (!path) {
          console.error("x-component missing path attribute:", component);
          return;
        }
        await importComponent(path, component);
      })
    );
  } catch (error) {
    console.error("Error loading components:", error);
  }
}

// Function to traverse parents and collect x-component attributes
export function getParentAttributes(el) {
  let element = el;
  let attrs = {};

  while (element) {
    if (element.tagName.toLowerCase() === 'x-component') {
      // Get all attributes
      for (let attr of element.attributes) {
        try {
          // Try to parse as JSON first
          attrs[attr.name] = JSON.parse(attr.value);
        } catch (_e) {
          // If not JSON, use raw value
          attrs[attr.name] = attr.value;
        }
      }
    }
    element = element.parentElement;
  }
  return attrs;
}
// expose as global for x-components in Alpine
globalThis.xAttrs = getParentAttributes;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadComponents());
} else {
  loadComponents();
}

// Watch for DOM changes to dynamically load x-components
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) {
        // ELEMENT_NODE
        // Check if this node or its descendants contain x-component(s)
        if (node.matches?.("x-component")) {
          importComponent(node.getAttribute("path"), node);
        } else if (node.querySelectorAll) {
          loadComponents([node]);
        }
      }
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });