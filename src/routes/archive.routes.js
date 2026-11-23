const express = require("express");
const controller = require("../controllers/archive.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const {
  createArchiveSchema,
  updateArchiveSchema,
  archiveQuerySchema,
  timelineQuerySchema,
} = require("../validators/schemas");

const router = express.Router();

router.use(protect);

router.get("/timeline", validate(timelineQuerySchema, "query"), controller.timeline);
router
  .route("/")
  .get(validate(archiveQuerySchema, "query"), controller.list)
  .post(validate(createArchiveSchema), controller.create);

router
  .route("/:id")
  .get(controller.detail)
  .patch(validate(updateArchiveSchema), controller.update)
  .delete(controller.remove);

router.patch("/:id/favorite", controller.favorite);

module.exports = router;
