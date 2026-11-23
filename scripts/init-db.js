/**
 * Initialise the LifeVault database described by MONGODB_URI.
 *
 * - Verifies the connection and the target database name.
 * - Builds every Mongoose index (archives, categories, tags, reminders, ...).
 * - Prints collection counts so a fresh environment can be checked at a glance.
 *
 * Safe to re-run: `createIndexes()` only adds missing indexes and never drops
 * data or existing indexes. User documents are created by the API's signup
 * flow, which also seeds the ten default categories.
 *
 * Usage: npm run db:init
 */
const mongoose = require("mongoose");
const env = require("../src/config/env");

const models = {
  users: require("../src/models/User"),
  archives: require("../src/models/Archive"),
  categories: require("../src/models/Category"),
  tags: require("../src/models/Tag"),
  collections: require("../src/models/Collection"),
  reminders: require("../src/models/Reminder"),
  uploads: require("../src/models/Upload"),
};

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const { host, name } = mongoose.connection;
  console.log(`Connected to ${host}/${name}`);

  if (!name || name === "test") {
    throw new Error(
      "MONGODB_URI has no database name (or points at `test`). Append a dedicated database, e.g. ...mongodb.net/lifevault"
    );
  }

  for (const [label, Model] of Object.entries(models)) {
    await Model.createIndexes();
    console.log(`  indexes ready: ${label}`);
  }

  console.log("Collection counts:");
  for (const label of Object.keys(models)) {
    const count = await mongoose.connection.db.collection(label).countDocuments();
    console.log(`  ${label}: ${count}`);
  }

  console.log("Database ready.");
}

main()
  .catch((error) => {
    console.error("Database setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
