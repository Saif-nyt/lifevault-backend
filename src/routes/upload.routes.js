const express = require("express");
const multer = require("multer");
const controller = require("../controllers/upload.controller");
const { protect } = require("../middleware/auth");
const { ApiError } = require("../utils/ApiError");

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new ApiError(400, "Unsupported file type. Use JPEG, PNG, WebP, GIF, PDF or plain text."));
    }
    cb(null, true);
  },
});

const router = express.Router();
router.use(protect);

router.post("/", upload.single("file"), controller.create);
router.delete("/:id", controller.remove);

module.exports = router;
