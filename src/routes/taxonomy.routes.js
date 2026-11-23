const express = require("express");
const controller = require("../controllers/taxonomy.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const {
  categoryCreateSchema,
  categoryUpdateSchema,
  tagCreateSchema,
} = require("../validators/schemas");

const router = express.Router();

router
  .route("/categories")
  .get(protect, controller.listCategories)
  .post(protect, validate(categoryCreateSchema), controller.createCategory);
router
  .route("/categories/:id")
  .patch(protect, validate(categoryUpdateSchema), controller.updateCategory)
  .delete(protect, controller.deleteCategory);

router
  .route("/tags")
  .get(protect, controller.listTags)
  .post(protect, validate(tagCreateSchema), controller.createTag);
router.delete("/tags/:id", protect, controller.deleteTag);

module.exports = router;
