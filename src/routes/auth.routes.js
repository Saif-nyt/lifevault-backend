const express = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("../validators/schemas");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), controller.register);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/google", authLimiter, controller.googleLogin);
router.post("/logout", controller.logout);
router.get("/me", protect, controller.me);
router.patch("/me", protect, validate(updateProfileSchema), controller.updateProfile);
router.patch("/password", protect, validate(changePasswordSchema), controller.changePassword);

module.exports = router;
