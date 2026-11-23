const dashboardService = require("../services/dashboard.service");
const { sendSuccess } = require("../utils/http");

async function stats(req, res) {
  const data = await dashboardService.getStats(req.user._id);
  sendSuccess(res, data);
}

async function recent(req, res) {
  const items = await dashboardService.getRecent(req.user._id);
  sendSuccess(res, { items });
}

async function favorites(req, res) {
  const items = await dashboardService.getFavorites(req.user._id);
  sendSuccess(res, { items });
}

async function upcomingReminders(req, res) {
  const reminders = await dashboardService.getUpcomingReminders(req.user._id);
  sendSuccess(res, { reminders });
}

async function rediscover(req, res) {
  const items = await dashboardService.getRediscover(req.user._id);
  sendSuccess(res, { items });
}

module.exports = { stats, recent, favorites, upcomingReminders, rediscover };
