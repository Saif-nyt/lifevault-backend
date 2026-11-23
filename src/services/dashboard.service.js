const mongoose = require("mongoose");
const Archive = require("../models/Archive");
const Reminder = require("../models/Reminder");
const Collection = require("../models/Collection");
const Tag = require("../models/Tag");
const { listCategories } = require("./taxonomy.service");
const { serializeArchive } = require("./archive.service");

const USER_ID = (userId) => new mongoose.Types.ObjectId(userId);

async function getStats(userId) {
  const [total, favorites, reminders, collections, tags, byType, categories] = await Promise.all([
    Archive.countDocuments({ user: userId }),
    Archive.countDocuments({ user: userId, isFavorite: true }),
    Reminder.countDocuments({ user: userId, completed: false, remindAt: { $gte: new Date() } }),
    Collection.countDocuments({ user: userId }),
    Tag.countDocuments({ user: userId }),
    Archive.aggregate([
      { $match: { user: USER_ID(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    listCategories(userId),
  ]);

  return {
    totalItems: total,
    favorites,
    upcomingReminders: reminders,
    collections,
    tags,
    byType: byType.map((entry) => ({ type: entry._id, count: entry.count })),
    categories,
  };
}

async function getRecent(userId, limit = 6) {
  const items = await Archive.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("category", "name color")
    .populate("tags", "name");
  return items.map(serializeArchive);
}

async function getFavorites(userId, limit = 6) {
  const items = await Archive.find({ user: userId, isFavorite: true })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate("category", "name color")
    .populate("tags", "name");
  return items.map(serializeArchive);
}

async function getUpcomingReminders(userId, limit = 5) {
  const reminders = await Reminder.find({
    user: userId,
    completed: false,
    remindAt: { $gte: new Date() },
  })
    .sort({ remindAt: 1 })
    .limit(limit)
    .populate("archive", "title type")
    .lean();
  return reminders.map((reminder) => ({ ...reminder, id: String(reminder._id) }));
}

async function getRediscover(userId, limit = 5) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let items = await Archive.aggregate([
    { $match: { user: USER_ID(userId), createdAt: { $lte: weekAgo } } },
    { $sample: { size: limit } },
  ]);

  if (!items.length) {
    items = await Archive.aggregate([
      { $match: { user: USER_ID(userId) } },
      { $sample: { size: limit } },
    ]);
  }

  const populated = await Archive.populate(items, [
    { path: "category", select: "name color" },
    { path: "tags", select: "name" },
  ]);
  return populated.map(serializeArchive);
}

module.exports = { getStats, getRecent, getFavorites, getUpcomingReminders, getRediscover };
