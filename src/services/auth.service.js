const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const { DEFAULT_CATEGORIES } = require("../config/defaults");
const { ApiError } = require("../utils/ApiError");
const { signToken } = require("../utils/token");
const env = require("../config/env");

const SALT_ROUNDS = 12;

async function register({ name, email, password }) {
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

  return { user: user.toSafeJSON(), token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw new ApiError(401, "Invalid email or password");

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new ApiError(401, "Invalid email or password");

  user.passwordHash = undefined;
  return { user: user.toSafeJSON(), token: signToken(user) };
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
}

async function googleLogin({ idToken }) {
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
  return { user: user.toSafeJSON(), token: signToken(user) };
}

module.exports = { register, login, getProfile, updateProfile, changePassword, googleLogin };
