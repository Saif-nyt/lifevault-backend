const express = require("express");
const controller = require("../controllers/collection.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const {
  collectionCreateSchema,
  collectionUpdateSchema,
  collectionItemSchema,
} = require("../validators/schemas");

const router = express.Router();
router.use(protect);

router.route("/").get(controller.list).post(validate(collectionCreateSchema), controller.create);
router
  .route("/:id")
  .get(controller.detail)
  .patch(validate(collectionUpdateSchema), controller.update)
  .delete(controller.remove);

router.post("/:id/items", validate(collectionItemSchema), controller.addItem);
router.delete("/:id/items/:itemId", controller.removeItem);

module.exports = router;
