const Reminder = require("../models/Reminder");
const Archive = require("../models/Archive");
const { ApiError } = require("../utils/ApiError");

function serializeReminder(reminder) {
  if (!reminder) return null;
  const obj = reminder.toObject ? reminder.toObject() : { ...reminder };
  return {
    ...obj,
    id: String(obj._id),
    archive:
      obj.archive && typeof obj.archive === "object" && obj.archive._id
        ? { ...obj.archive, id: String(obj.archive._id) }
        : obj.archive || null,
  };
}

async function listReminders(userId, query = {}) {
  const filter = { user: userId };
  if (query.completed !== undefined) filter.completed = query.completed === "true";
  if (query.upcoming === "true") {
    filter.completed = false;
    filter.remindAt = { $gte: new Date() };
  }

  const reminders = await Reminder.find(filter)
    .populate("archive", "title type")
    .sort({ remindAt: 1 })
    .lean();

  return reminders.map(serializeReminder);
}

async function createReminder(userId, data) {
  if (data.archive) {
    const archive = await Archive.findOne({ _id: data.archive, user: userId });
    if (!archive) throw new ApiError(400, "Linked archive item not found");
  }

  const reminder = await Reminder.create({
    user: userId,
    archive: data.archive || null,
    source: "manual",
    title: data.title,
    note: data.note || "",
    remindAt: data.remindAt,
  });

  return serializeReminder(reminder);
}

async function updateReminder(userId, reminderId, data) {
  const reminder = await Reminder.findOne({ _id: reminderId, user: userId });
  if (!reminder) throw new ApiError(404, "Reminder not found");

  if (data.title !== undefined) reminder.title = data.title;
  if (data.note !== undefined) reminder.note = data.note;
  if (data.remindAt !== undefined) reminder.remindAt = data.remindAt;
  if (data.completed !== undefined) {
    reminder.completed = data.completed;
    reminder.completedAt = data.completed ? new Date() : null;
  }

  await reminder.save();
  return serializeReminder(reminder);
}

async function deleteReminder(userId, reminderId) {
  const reminder = await Reminder.findOneAndDelete({ _id: reminderId, user: userId });
  if (!reminder) throw new ApiError(404, "Reminder not found");
  return reminder;
}

module.exports = { listReminders, createReminder, updateReminder, deleteReminder, serializeReminder };
