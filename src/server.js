const app = require("./app");
const env = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./config/db");

async function start() {
  try {
    await connectDatabase();
    console.log("MongoDB connected");

    const server = app.listen(env.PORT, () => {
      console.log(`LifeVault API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
