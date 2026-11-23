const Category = require("../models/Category");
const Archive = require("../models/Archive");
const Tag = require("../models/Tag");
const { ApiError } = require("../utils/ApiError");
const { DEFAULT_CATEGORIES } = require("../config/defaults");

async function listCategories(userId) {
  const categories = await Category.find({ user: userId }).sort({ isDefault: -1, name: 1 }).lean();
  const counts = await Archive.aggregate([
    { $match: { user: new (require("mongoose").Types.ObjectId)(userId) } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));

  return categories.map((category) => ({
    ...category,
    id: String(category._id),
    itemCount: countMap.get(String(category._id)) || 0,
  }));
}

async function ensureDefaults(userId) {
  const existing = await Category.countDocuments({ user: userId });
  if (existing > 0) return;

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      user: userId,
      nameKey: category.name.toLowerCase(),
      isDefault: true,
    }))
  );
}

async function createCategory(userId, { name, color }) {
  const nameKey = name.toLowerCase();
  const exists = await Category.findOne({ user: userId, nameKey });
  if (exists) throw new ApiError(409, "A category with this name already exists");

  const category = await Category.create({
    user: userId,
    name,
    nameKey,
    color: color || "#7A7A7A",
  });
  return category;
}

async function updateCategory(userId, categoryId, updates) {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) throw new ApiError(404, "Category not found");

  if (updates.name && updates.name.toLowerCase() !== category.nameKey) {
    const nameKey = updates.name.toLowerCase();
    const exists = await Category.findOne({ user: userId, nameKey });
    if (exists) throw new ApiError(409, "A category with this name already exists");
    category.name = updates.name;
    category.nameKey = nameKey;
  }
  if (updates.color) category.color = updates.color;

  await category.save();
  return category;
}

async function deleteCategory(userId, categoryId) {
  const category = await Category.findOneAndDelete({ _id: categoryId, user: userId });
  if (!category) throw new ApiError(404, "Category not found");

  await Archive.updateMany({ user: userId, category: category._id }, { $set: { category: null } });
  return category;
}

async function listTags(userId) {
  const tags = await Tag.find({ user: userId }).sort({ name: 1 }).lean();
  const counts = await Archive.aggregate([
    { $match: { user: new (require("mongoose").Types.ObjectId)(userId) } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return tags.map((tag) => ({ ...tag, id: String(tag._id), itemCount: countMap.get(String(tag._id)) || 0 }));
}

async function createTag(userId, { name }) {
  const nameKey = name.toLowerCase();
  const exists = await Tag.findOne({ user: userId, nameKey });
  if (exists) return exists;

  return Tag.create({ user: userId, name, nameKey });
}

async function deleteTag(userId, tagId) {
  const tag = await Tag.findOneAndDelete({ _id: tagId, user: userId });
  if (!tag) throw new ApiError(404, "Tag not found");

  await Archive.updateMany(
    { user: userId, tags: tag._id },
    { $pull: { tags: tag._id, tagNames: tag.name } }
  );
  return tag;
}

async function resolveTags(userId, tagInputs = []) {
  const ids = [];
  const names = [];
  const seen = new Set();

  for (const value of tagInputs) {
    let tag;
    if (/^[a-f\d]{24}$/i.test(value)) {
      tag = await Tag.findOne({ _id: value, user: userId });
      if (!tag) throw new ApiError(400, "One of the selected tags does not exist");
    } else {
      const name = value.trim();
      if (!name) continue;
      const nameKey = name.toLowerCase();
      if (seen.has(nameKey)) continue;
      tag = await Tag.findOne({ user: userId, nameKey });
      if (!tag) tag = await Tag.create({ user: userId, name, nameKey });
    }

    const id = String(tag._id);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(tag._id);
      names.push(tag.name);
    }
  }

  return { ids, names };
}

module.exports = {
  listCategories,
  ensureDefaults,
  createCategory,
  updateCategory,
  deleteCategory,
  listTags,
  createTag,
  deleteTag,
  resolveTags,
};
