const env = require("../config/env");
const { ApiError } = require("../utils/ApiError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie-authenticated state changes require a trusted Origin/Referer.
 * Combined with SameSite cookies (Lax in dev, None+Secure in prod), this blocks
 * cross-site form/fetch CSRF. Requests without Origin (curl, health checks,
 * tests) are allowed.
 */
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!origin && !referer) return next();

  const candidate = origin || (() => {
    try {
      return new URL(referer).origin;
    } catch {
      return "";
    }
  })();

  if (!env.origins.includes(candidate)) {
    return next(new ApiError(403, "Request origin is not allowed"));
  }

  next();
}

module.exports = csrfProtection;
