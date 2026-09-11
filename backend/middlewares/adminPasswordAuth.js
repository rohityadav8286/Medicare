import jwt from "jsonwebtoken";
import { requireAdminIdentity } from "./adminIdentityAuth.js";

const COOKIE_NAME = "admin_dashboard_session";

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const entry = cookieHeader.split(";").find((part) => part.trim().startsWith(`${name}=`));
  if (!entry) return null;

  return decodeURIComponent(entry.trim().slice(name.length + 1));
}

export const adminSessionSecret = () =>
  process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || null;

export function requireAdminPassword(req, res, next) {
  const secret = adminSessionSecret();
  const token = readCookie(req, COOKIE_NAME);

  if (!secret || !token) {
    return res.status(401).json({ success: false, message: "Admin password required." });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload.scope !== "admin-dashboard") throw new Error("Invalid admin session");
    req.adminSession = payload;
    return requireAdminIdentity(req, res, () => {
      if (payload.sub !== req.adminIdentity.userId) {
        return res.status(401).json({
          success: false,
          message: "Admin account changed. Enter the password again.",
        });
      }
      return next();
    });
  } catch {
    return res.status(401).json({ success: false, message: "Admin session expired. Enter the password again." });
  }
}

export { COOKIE_NAME };
