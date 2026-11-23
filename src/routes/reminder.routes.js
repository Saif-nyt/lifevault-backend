const express = require("express");
const controller = require("../controllers/reminder.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const {
  reminderCreateSchema,
  reminderUpdateSchema,
  reminderQuerySchema,
} = require("../validators/schemas");

const router = express.Router();
router.use(protect);

router
  .route("/")
  .get(validate(reminderQuerySchema, "query"), controller.list)
  .post(validate(reminderCreateSchema), controller.create);
router
  .route("/:id")
  .patch(validate(reminderUpdateSchema), controller.update)
  .delete(controller.remove);

module.exports = router;
