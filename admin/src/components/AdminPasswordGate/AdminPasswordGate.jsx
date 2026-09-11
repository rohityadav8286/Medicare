import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

function storeAdminToken(token) {
  if (!token) return;
  try {
    localStorage.setItem("clerk_token", token);
  } catch {
    // Requests can still use the cookie-based admin-password session.
  }
}

export default function AdminPasswordGate({ children }) {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkSession = async () => {
    try {
      const token = await getToken();
      storeAdminToken(token);
      const response = await fetch(`${API_BASE}/api/admin/session`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setStatus(response.ok ? "authorized" : "locked");
    } catch {
      setStatus("locked");
    }
  };

  useEffect(() => {
    checkSession();
  }, [getToken]);

  const unlock = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      if (!token) {
        setError("Your admin sign-in session is unavailable. Sign out and sign in again.");
        return;
      }
      storeAdminToken(token);
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const responseText = await response.text();
      let body = {};
      try {
        body = responseText ? JSON.parse(responseText) : {};
      } catch {
        // A non-JSON response is still reported below with its status code.
      }

      if (!response.ok) {
        setError(
          body.message ||
            `Unable to unlock the dashboard (server returned ${response.status}).`,
        );
        return;
      }

      setPassword("");
      setStatus("authorized");
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (authLoaded && !isSignedIn) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 flex items-center justify-center">
        <p className="rounded-xl bg-white p-6 text-slate-700">Please sign in with an admin account first.</p>
      </main>
    );
  }

  if (status === "authorized") return children;

  return (
    <main className="min-h-screen bg-slate-950 px-4 flex items-center justify-center">
      <form onSubmit={unlock} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Admin dashboard locked</h1>
        <p className="mt-2 text-sm text-slate-600">Enter the administrator password to continue.</p>
        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          required
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={submitting} className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Checking…" : "Unlock dashboard"}
        </button>
      </form>
    </main>
  );
}
