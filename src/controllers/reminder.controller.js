const reminderService = require("../services/reminder.service");
const { sendSuccess } = require("../utils/http");

async function list(req, res) {
  const reminders = await reminderService.listReminders(req.user._id, req.validatedQuery || req.query);
  sendSuccess(res, { reminders });
}

async function create(req, res) {
  const reminder = await reminderService.createReminder(req.user._id, req.body);
  sendSuccess(res, { reminder }, 201);
}

async function update(req, res) {
  const reminder = await reminderService.updateReminder(req.user._id, req.params.id, req.body);
  sendSuccess(res, { reminder });
}

async function remove(req, res) {
  await reminderService.deleteReminder(req.user._id, req.params.id);
  sendSuccess(res, { message: "Reminder deleted" });
}

module.exports = { list, create, update, remove };
