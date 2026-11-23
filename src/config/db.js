const mongoose = require("mongoose");
const env = require("./env");

// Cache the connection across serverless invocations (Vercel) and hot reloads.
let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set("strictQuery", true);

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 10000,
        maxPoolSize: 5,
        autoIndex: !env.isProd,
        retryWrites: true,
      })
      .then((m) => {
        console.log("MongoDB connected");
        return m.connection;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

async function disconnectDatabase() {
  // No-op on serverless; keep connection warm.
}

module.exports = { connectDatabase, disconnectDatabase };
