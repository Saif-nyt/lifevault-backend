const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const skip = () => env.isTest;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message: { success: false, message: "Too many requests. Please slow down." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message: { success: false, message: "Too many authentication attempts. Try again later." },
});

module.exports = { apiLimiter, authLimiter };
