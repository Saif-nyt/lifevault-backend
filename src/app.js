const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const multer = require("multer");

const env = require("./config/env");
const { connectDatabase } = require("./config/db");

const routes = require("./routes");
const csrfProtection = require("./middleware/csrf");
const { apiLimiter } = require("./middleware/rateLimit");
const { errorHandler, notFound, ApiError } = require("./utils/ApiError");

const app = express();

// Ensure DB is connected for serverless (Vercel) cold starts.
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

if (env.isProd) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.origins.includes(origin)) return callback(null, true);
      callback(new ApiError(403, "Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use(csrfProtection);
if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    data: { name: "LifeVault API", version: "v1", docs: "/api/v1/health" },
  });
});

app.use("/api/v1", apiLimiter, routes);
app.use(notFound);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large. Maximum size is 10 MB." : err.message;
    return res.status(400).json({ success: false, message });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      details: Object.values(err.errors).map((entry) => entry.message),
    });
  }
  return errorHandler(err, req, res, next);
});

module.exports = app;
