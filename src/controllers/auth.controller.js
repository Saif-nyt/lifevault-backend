const authService = require("../services/auth.service");
const { sendSuccess } = require("../utils/http");
const { setAuthCookie, clearAuthCookie } = require("../utils/token");

async function register(req, res) {
  const data = await authService.register(req.body, req);
  setAuthCookie(res, data.webToken);
  sendSuccess(
    res,
    {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      token: data.token,
    },
    201
  );
}

async function login(req, res) {
  const data = await authService.login(req.body, req);
  setAuthCookie(res, data.webToken);
  sendSuccess(res, {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    token: data.token,
  });
}

async function refresh(req, res) {
  const data = await authService.refresh(req.body.refreshToken, req);
  setAuthCookie(res, data.webToken);
  sendSuccess(res, {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    token: data.token,
  });
}

async function googleLogin(req, res) {
  const data = await authService.googleLogin(req.body, req);
  setAuthCookie(res, data.webToken);
  sendSuccess(res, {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    token: data.token,
  });
}

async function logout(req, res) {
  if (req.body?.refreshToken) {
    await authService.revokeRefresh(req.body.refreshToken);
  }
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
  sendSuccess(res, { message: "Password updated. Please sign in again on other devices." });
}

module.exports = { register, login, refresh, logout, me, updateProfile, changePassword, googleLogin };
