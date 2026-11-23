const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    originalName: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", uploadSchema);
