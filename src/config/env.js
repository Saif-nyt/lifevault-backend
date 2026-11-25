const path = require("node:path");
const { z } = require("zod");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("60m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  EXTRA_ORIGINS: z.string().optional().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  GOOGLE_WEB_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional().default("923673012580-ikf38u0u5r3lc64uumnnce1mfdqdbojk.apps.googleusercontent.com"),});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

env.isProd = env.NODE_ENV === "production";
env.isTest = env.NODE_ENV === "test";
env.origins = [env.FRONTEND_URL, ...env.EXTRA_ORIGINS.split(",")]
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
env.cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);
if (!env.GOOGLE_WEB_CLIENT_ID && env.GOOGLE_CLIENT_ID) env.GOOGLE_WEB_CLIENT_ID = env.GOOGLE_CLIENT_ID;
env.googleClientIds = [env.GOOGLE_WEB_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID].filter(Boolean);

module.exports = env;
