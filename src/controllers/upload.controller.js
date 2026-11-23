const uploadService = require("../services/upload.service");
const { sendSuccess } = require("../utils/http");

async function create(req, res) {
  const upload = await uploadService.uploadFile(req.user._id, req.file);
  sendSuccess(res, { upload }, 201);
}

async function remove(req, res) {
  await uploadService.deleteUpload(req.user._id, req.params.id);
  sendSuccess(res, { message: "Upload deleted" });
}

module.exports = { create, remove };
