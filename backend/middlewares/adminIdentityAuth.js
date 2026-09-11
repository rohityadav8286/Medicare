import { createClerkClient } from "@clerk/clerk-sdk-node";

let adminClerkClient = null;

export function getAdminClerkClient() {
  if (!process.env.ADMIN_CLERK_SECRET_KEY) return null;

  if (!adminClerkClient) {
    adminClerkClient = createClerkClient({
      secretKey: process.env.ADMIN_CLERK_SECRET_KEY,
    });
  }

  return adminClerkClient;
}

const configuredAdminEmails = () =>
  new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

// Verifies that the signed-in Clerk account belongs to an administrator.
// The allowlist lives only on the server, so a browser cannot grant itself
// admin access by changing client-side code.
export async function requireAdminIdentity(req, res, next) {
  const clerk = getAdminClerkClient();
  if (!clerk) {
    return res.status(503).json({
      success: false,
      message: "Admin sign-in is not configured. Set ADMIN_CLERK_SECRET_KEY on the server.",
    });
  }

  const allowedEmails = configuredAdminEmails();
  if (allowedEmails.size === 0) {
    return res.status(503).json({
      success: false,
      message: "Admin access is not configured. Set ADMIN_EMAILS on the server.",
    });
  }

  // Verify the Admin Clerk bearer token here instead of only in adminRouter.
  // This middleware is shared by all sensitive admin routes, including
  // /api/doctors/:id/admin, /api/services and appointment updates.
  let userId = req.adminAuth?.userId || null;
  if (!userId) {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;

    if (token) {
      try {
        const claims = await clerk.verifyToken(token);
        userId = claims.sub || null;
        req.adminAuth = { userId };
      } catch (error) {
        console.error("Admin token verification failed:", error?.message);
        return res.status(401).json({
          success: false,
          message: "Your admin sign-in session has expired. Please sign in again.",
        });
      }
    }
  }

  if (!userId) {
    return res.status(401).json({ success: false, message: "Please sign in with an admin email." });
  }

  try {
    const user = await clerk.users.getUser(userId);
    const emails = (user.emailAddresses || []).map((address) =>
      String(address.emailAddress || "").trim().toLowerCase(),
    );
    const email = emails.find((candidate) => allowedEmails.has(candidate));

    if (!email) {
      return res.status(403).json({
        success: false,
        message: "This email is not authorized to access the admin dashboard.",
      });
    }

    req.adminIdentity = { userId, email };
    return next();
  } catch (error) {
    console.error("Admin identity verification failed:", error?.message);
    return res.status(503).json({
      success: false,
      message: "Unable to verify admin access. Please try again.",
    });
  }
}
