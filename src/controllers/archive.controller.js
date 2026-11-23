const archiveService = require("../services/archive.service");
const { sendSuccess } = require("../utils/http");

async function create(req, res) {
  const archive = await archiveService.createArchive(req.user._id, req.body);
  sendSuccess(res, { archive }, 201);
}

async function list(req, res) {
  const { items, meta } = await archiveService.listArchives(req.user._id, req.validatedQuery || req.query);
  sendSuccess(res, { items }, 200, meta);
}

async function detail(req, res) {
  const archive = await archiveService.getArchive(req.user._id, req.params.id);
  sendSuccess(res, { archive });
}

async function update(req, res) {
  const archive = await archiveService.updateArchive(req.user._id, req.params.id, req.body);
  sendSuccess(res, { archive });
}

async function remove(req, res) {
  await archiveService.deleteArchive(req.user._id, req.params.id);
  sendSuccess(res, { message: "Archive item deleted" });
}

async function favorite(req, res) {
  const archive = await archiveService.toggleFavorite(req.user._id, req.params.id);
  sendSuccess(res, { archive });
}

async function timeline(req, res) {
  const data = await archiveService.getTimeline(req.user._id, req.validatedQuery || req.query);
  sendSuccess(res, data);
}

module.exports = { create, list, detail, update, remove, favorite, timeline };
