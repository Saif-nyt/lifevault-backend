const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true },
    color: { type: String, default: "#7A7A7A", maxlength: 20 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ user: 1, nameKey: 1 }, { unique: true });
categorySchema.index({ user: 1, createdAt: 1 });

module.exports = mongoose.model("Category", categorySchema);
