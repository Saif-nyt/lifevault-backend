const jwt = require("jsonwebtoken");
const env = require("../config/env");

const COOKIE_NAME = "lifevault_token";

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? "none" : "lax",
    domain: ".vercel.app",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie, cookieOptions };
