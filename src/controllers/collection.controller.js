const collectionService = require("../services/collection.service");
const { sendSuccess } = require("../utils/http");

async function list(req, res) {
  const collections = await collectionService.listCollections(req.user._id);
  sendSuccess(res, { collections });
}

async function detail(req, res) {
  const collection = await collectionService.getCollection(req.user._id, req.params.id);
  sendSuccess(res, { collection });
}

async function create(req, res) {
  const collection = await collectionService.createCollection(req.user._id, req.body);
  sendSuccess(res, { collection }, 201);
}

async function update(req, res) {
  const collection = await collectionService.updateCollection(req.user._id, req.params.id, req.body);
  sendSuccess(res, { collection });
}

async function remove(req, res) {
  await collectionService.deleteCollection(req.user._id, req.params.id);
  sendSuccess(res, { message: "Collection deleted" });
}

async function addItem(req, res) {
  const collection = await collectionService.addItem(req.user._id, req.params.id, req.body.archiveId);
  sendSuccess(res, { collection });
}

async function removeItem(req, res) {
  const collection = await collectionService.removeItem(req.user._id, req.params.id, req.params.itemId);
  sendSuccess(res, { collection });
}

module.exports = { list, detail, create, update, remove, addItem, removeItem };
