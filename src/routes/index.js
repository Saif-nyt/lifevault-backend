const express = require("express");
const authRoutes = require("./auth.routes");
const archiveRoutes = require("./archive.routes");
const taxonomyRoutes = require("./taxonomy.routes");
const collectionRoutes = require("./collection.routes");
const reminderRoutes = require("./reminder.routes");
const uploadRoutes = require("./upload.routes");
const dashboardRoutes = require("./dashboard.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

router.use("/auth", authRoutes);
router.use("/archives", archiveRoutes);
router.use("/", taxonomyRoutes);
router.use("/collections", collectionRoutes);
router.use("/reminders", reminderRoutes);
router.use("/uploads", uploadRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
