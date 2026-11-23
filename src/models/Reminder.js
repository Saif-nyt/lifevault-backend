const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    archive: { type: mongoose.Schema.Types.ObjectId, ref: "Archive", default: null },
    source: { type: String, enum: ["manual", "archive"], default: "manual" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, default: "", maxlength: 1000 },
    remindAt: { type: Date, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reminderSchema.index({ user: 1, completed: 1, remindAt: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);
