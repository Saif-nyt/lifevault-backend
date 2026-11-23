const mongoose = require("mongoose");

const ARCHIVE_TYPES = ["note", "link", "memory", "video", "image", "document", "book", "movie", "idea", "event"];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "auto" },
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    originalName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const archiveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    content: { type: String, default: "", maxlength: 100000 },
    type: { type: String, enum: ARCHIVE_TYPES, required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    tagNames: [{ type: String }],
    sourceUrl: { type: String, default: "", maxlength: 2048 },
    attachments: { type: [attachmentSchema], default: [] },
    isFavorite: { type: Boolean, default: false },
    reminderAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

archiveSchema.index({ user: 1, createdAt: -1 });
archiveSchema.index({ user: 1, type: 1, createdAt: -1 });
archiveSchema.index({ user: 1, category: 1, createdAt: -1 });
archiveSchema.index({ user: 1, isFavorite: 1, createdAt: -1 });
archiveSchema.index({ user: 1, tags: 1 });
archiveSchema.index({ user: 1, reminderAt: 1 });
archiveSchema.index(
  { title: "text", description: "text", content: "text", sourceUrl: "text", tagNames: "text" },
  { name: "archive_text_search" }
);

module.exports = mongoose.model("Archive", archiveSchema);
module.exports.ARCHIVE_TYPES = ARCHIVE_TYPES;
