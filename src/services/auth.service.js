const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const AuthSession = require("../models/AuthSession");
const { DEFAULT_CATEGORIES } = require("../config/defaults");
const { ApiError } = require("../utils/ApiError");
const {
  signToken,
  signAccessToken,
  createRefreshToken,
  hashRefreshToken,
} = require("../utils/token");
const env = require("../config/env");

const SALT_ROUNDS = 12;

function requestContext(req) {
  return {
    userAgent: String(req?.get?.("user-agent") || "").slice(0, 300),
    ip: String(req?.ip || req?.headers?.["x-forwarded-for"] || "").slice(0, 80),
  };
}

async function createMobileSession(user, req) {
  const refreshToken = createRefreshToken();
  const ttlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const context = requestContext(req);

  await AuthSession.deleteMany({ user: user._id, expiresAt: { $lt: new Date() } });
  await AuthSession.create({
    user: user._id,
    refreshHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + ttlMs),
    ...context,
  });

  return { refreshToken, expiresIn: env.ACCESS_TOKEN_EXPIRES_IN };
}

function tokenPayload(user, webToken, session) {
  const accessToken = signAccessToken(user);
  return {
    user,
    // `token` is retained for older clients. New clients should use accessToken.
    token: accessToken,
    accessToken,
    refreshToken: session.refreshToken,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    webToken,
  };
}

async function register({ name, email, password }, req) {
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  try {
    await Category.insertMany(
      DEFAULT_CATEGORIES.map((category) => ({
        ...category,
        user: user._id,
        nameKey: category.name.toLowerCase(),
        isDefault: true,
      })),
      { ordered: true }
    );
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  const safeUser = user.toSafeJSON();
  const session = await createMobileSession(user, req);
  return tokenPayload(safeUser, signToken(user), session);
}

async function login({ email, password }, req) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw new ApiError(401, "Invalid email or password");

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new ApiError(401, "Invalid email or password");

  user.passwordHash = undefined;
  const safeUser = user.toSafeJSON();
  const session = await createMobileSession(user, req);
  return tokenPayload(safeUser, signToken(user), session);
}

async function refresh(refreshToken, req) {
  if (!refreshToken) throw new ApiError(401, "Refresh token is required");

  const session = await AuthSession.findOne({
    refreshHash: hashRefreshToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw new ApiError(401, "Refresh token is invalid or expired. Please log in again.");

  const user = await User.findById(session.user);
  if (!user) {
    await AuthSession.deleteOne({ _id: session._id });
    throw new ApiError(401, "User no longer exists");
  }

  // Rotate: the previous refresh token is invalid immediately after this call.
  const nextToken = createRefreshToken();
  const ttlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  session.refreshHash = hashRefreshToken(nextToken);
  session.expiresAt = new Date(Date.now() + ttlMs);
  session.lastUsedAt = new Date();
  const context = requestContext(req);
  if (context.userAgent) session.userAgent = context.userAgent;
  if (context.ip) session.ip = context.ip;
  await session.save();

  const safeUser = user.toSafeJSON();
  return tokenPayload(
    safeUser,
    signToken(user),
    { refreshToken: nextToken, expiresIn: env.ACCESS_TOKEN_EXPIRES_IN }
  );
}

async function revokeRefresh(refreshToken) {
  if (!refreshToken) return false;
  const result = await AuthSession.findOneAndUpdate(
    { refreshHash: hashRefreshToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return Boolean(result);
}

async function revokeAllForUser(userId) {
  await AuthSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return user.toSafeJSON();
}

async function updateProfile(userId, updates) {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, "User not found");
  return user.toSafeJSON();
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new ApiError(404, "User not found");

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new ApiError(401, "Current password is incorrect");

  const same = await bcrypt.compare(newPassword, user.passwordHash);
  if (same) throw new ApiError(400, "New password must be different");

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
  await revokeAllForUser(user._id);
}

async function googleLogin({ idToken }, req) {
  if (!idToken) throw new ApiError(400, "idToken is required");
  if (!env.googleClientIds.length) throw new ApiError(500, "Google login not configured");

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new ApiError(401, "Invalid Google token");
  const payload = await res.json();

  if (!payload.email_verified) throw new ApiError(401, "Google email not verified");
  if (!env.googleClientIds.includes(payload.aud)) throw new ApiError(401, "Google token audience mismatch");

  let user = await User.findOne({ email: payload.email });
  if (!user) {
    user = await User.create({
      name: payload.name || payload.email.split("@")[0],
      email: payload.email,
      passwordHash: await bcrypt.hash(`google-${payload.sub}-${Date.now()}`, SALT_ROUNDS),
      googleId: payload.sub,
    });
    try {
      await Category.insertMany(
        DEFAULT_CATEGORIES.map((category) => ({
          ...category,
          user: user._id,
          nameKey: category.name.toLowerCase(),
          isDefault: true,
        })),
        { ordered: true }
      );
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    await user.save();
  }

  user.passwordHash = undefined;
  const safeUser = user.toSafeJSON();
  const session = await createMobileSession(user, req);
  return tokenPayload(safeUser, signToken(user), session);
}

module.exports = {
  register,
  login,
  refresh,
  revokeRefresh,
  revokeAllForUser,
  getProfile,
  updateProfile,
  changePassword,
  googleLogin,
};
