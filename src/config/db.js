const mongoose = require("mongoose");
const env = require("./env");

async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected; attempting reconnect...");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    autoIndex: !env.isProd,
    retryWrites: true,
  });
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
