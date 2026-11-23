const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    googleId: { type: String, default: "", index: true },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
