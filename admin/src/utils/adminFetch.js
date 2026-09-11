// Adds the Clerk token saved by the admin navigation to protected API calls.
// Cookie credentials are kept for the separate admin-password session.
export function adminFetch(input, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("clerk_token");

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...options, credentials: "include", headers });
}
