const authService = require("../services/auth.service");
const { sendSuccess } = require("../utils/http");
const { setAuthCookie, clearAuthCookie } = require("../utils/token");

async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  setAuthCookie(res, token);
  sendSuccess(res, { user }, 201);
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  setAuthCookie(res, token);
  sendSuccess(res, { user });
}

async function logout(req, res) {
  clearAuthCookie(res);
  sendSuccess(res, { message: "Logged out" });
}

async function me(req, res) {
  const user = await authService.getProfile(req.user._id);
  sendSuccess(res, { user });
}

async function updateProfile(req, res) {
  const user = await authService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { user });
}

async function changePassword(req, res) {
  await authService.changePassword(req.user._id, req.body);
  sendSuccess(res, { message: "Password updated" });
}

module.exports = { register, login, logout, me, updateProfile, changePassword };
