const mongoose = require("mongoose");

/**
 * A mobile/API refresh session. Only a SHA-256 hash of the opaque refresh token
 * is stored, so a database leak cannot be replayed against the API.
 */
const authSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: "", maxlength: 300 },
    ip: { type: String, default: "", maxlength: 80 },
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ user: 1, revokedAt: 1 });

module.exports = mongoose.model("AuthSession", authSessionSchema);
