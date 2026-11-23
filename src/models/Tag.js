const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    nameKey: { type: String, required: true },
  },
  { timestamps: true }
);

tagSchema.index({ user: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.model("Tag", tagSchema);
