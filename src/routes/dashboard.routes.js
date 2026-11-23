const express = require("express");
const controller = require("../controllers/dashboard.controller");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/stats", controller.stats);
router.get("/recent", controller.recent);
router.get("/favorites", controller.favorites);
router.get("/upcoming-reminders", controller.upcomingReminders);
router.get("/rediscover", controller.rediscover);

module.exports = router;
