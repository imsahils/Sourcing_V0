// Proxy is disabled for static export (output: 'export').
// Auth is handled client-side in each page via useCurrentUser + localStorage.
// This file is intentionally a no-op so the build doesn't warn about missing exports.

export function proxy() {}

export const config = { matcher: [] }
