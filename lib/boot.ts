/**
 * Node-only startup checks. Kept out of instrumentation.ts so the Edge bundle never sees
 * `process.exit`, which it cannot run.
 */
export async function assertEnvOrExit() {
  try {
    await import("./env");
  } catch (err) {
    console.error(`[csync] ${err instanceof Error ? err.message : err}`);
    // A misconfigured deploy must fail loudly: the container restart-loops and the proxy
    // serves the maintenance page, instead of every request throwing behind a bare 500.
    process.exit(1);
  }
}
