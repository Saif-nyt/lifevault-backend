const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const COOKIE_NAME = "lifevault_token";

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), typ: "web" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), typ: "access" }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? "none" : "lax",
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

function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = {
  COOKIE_NAME,
  signToken,
  signAccessToken,
  setAuthCookie,
  clearAuthCookie,
  cookieOptions,
  createRefreshToken,
  hashRefreshToken,
};
