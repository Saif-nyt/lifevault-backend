const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true },
    description: { type: String, default: "", maxlength: 500 },
    color: { type: String, default: "#7C6A9C", maxlength: 20 },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Archive" }],
  },
  { timestamps: true }
);

collectionSchema.index({ user: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.model("Collection", collectionSchema);
