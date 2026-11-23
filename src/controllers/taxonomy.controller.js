const taxonomy = require("../services/taxonomy.service");
const { sendSuccess } = require("../utils/http");

async function listCategories(req, res) {
  const categories = await taxonomy.listCategories(req.user._id);
  sendSuccess(res, { categories });
}

async function createCategory(req, res) {
  const category = await taxonomy.createCategory(req.user._id, req.body);
  sendSuccess(res, { category }, 201);
}

async function updateCategory(req, res) {
  const category = await taxonomy.updateCategory(req.user._id, req.params.id, req.body);
  sendSuccess(res, { category });
}

async function deleteCategory(req, res) {
  await taxonomy.deleteCategory(req.user._id, req.params.id);
  sendSuccess(res, { message: "Category deleted" });
}

async function listTags(req, res) {
  const tags = await taxonomy.listTags(req.user._id);
  sendSuccess(res, { tags });
}

async function createTag(req, res) {
  const tag = await taxonomy.createTag(req.user._id, req.body);
  sendSuccess(res, { tag }, 201);
}

async function deleteTag(req, res) {
  await taxonomy.deleteTag(req.user._id, req.params.id);
  sendSuccess(res, { message: "Tag deleted" });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listTags,
  createTag,
  deleteTag,
};
