const Collection = require("../models/Collection");
const Archive = require("../models/Archive");
const { ApiError } = require("../utils/ApiError");

async function listCollections(userId) {
  const collections = await Collection.find({ user: userId }).sort({ updatedAt: -1 }).lean();
  return collections.map((collection) => ({
    ...collection,
    id: String(collection._id),
    itemCount: collection.items.length,
  }));
}

async function getCollection(userId, collectionId) {
  const collection = await Collection.findOne({ _id: collectionId, user: userId })
    .populate({
      path: "items",
      select: "title description type category tags isFavorite attachments sourceUrl createdAt metadata",
      populate: [
        { path: "category", select: "name color" },
        { path: "tags", select: "name" },
      ],
    })
    .lean();

  if (!collection) throw new ApiError(404, "Collection not found");

  return {
    ...collection,
    id: String(collection._id),
    itemCount: collection.items.length,
    items: collection.items.map((item) => ({
      ...item,
      id: String(item._id),
      category: item.category ? { ...item.category, id: String(item.category._id) } : null,
      tags: (item.tags || []).map((tag) => ({ ...tag, id: String(tag._id) })),
    })),
  };
}

async function createCollection(userId, data) {
  const nameKey = data.name.toLowerCase();
  const exists = await Collection.findOne({ user: userId, nameKey });
  if (exists) throw new ApiError(409, "A collection with this name already exists");

  let items = [];
  if (data.items?.length) {
    const found = await Archive.find({ _id: { $in: data.items }, user: userId }).select("_id");
    if (found.length !== new Set(data.items).size) {
      throw new ApiError(400, "One or more archive items were not found");
    }
    items = found.map((item) => item._id);
  }

  return Collection.create({
    user: userId,
    name: data.name,
    nameKey,
    description: data.description || "",
    color: data.color || "#7C6A9C",
    items,
  });
}

async function updateCollection(userId, collectionId, data) {
  const collection = await Collection.findOne({ _id: collectionId, user: userId });
  if (!collection) throw new ApiError(404, "Collection not found");

  if (data.name && data.name.toLowerCase() !== collection.nameKey) {
    const nameKey = data.name.toLowerCase();
    const exists = await Collection.findOne({ user: userId, nameKey });
    if (exists) throw new ApiError(409, "A collection with this name already exists");
    collection.name = data.name;
    collection.nameKey = nameKey;
  }
  if (data.description !== undefined) collection.description = data.description;
  if (data.color) collection.color = data.color;

  await collection.save();
  return collection;
}

async function deleteCollection(userId, collectionId) {
  const collection = await Collection.findOneAndDelete({ _id: collectionId, user: userId });
  if (!collection) throw new ApiError(404, "Collection not found");
  return collection;
}

async function addItem(userId, collectionId, archiveId) {
  const [collection, archive] = await Promise.all([
    Collection.findOne({ _id: collectionId, user: userId }),
    Archive.findOne({ _id: archiveId, user: userId }).select("_id"),
  ]);
  if (!collection) throw new ApiError(404, "Collection not found");
  if (!archive) throw new ApiError(404, "Archive item not found");

  if (!collection.items.some((item) => String(item) === String(archive._id))) {
    collection.items.push(archive._id);
    await collection.save();
  }
  return collection;
}

async function removeItem(userId, collectionId, archiveId) {
  const collection = await Collection.findOne({ _id: collectionId, user: userId });
  if (!collection) throw new ApiError(404, "Collection not found");

  collection.items = collection.items.filter((item) => String(item) !== String(archiveId));
  await collection.save();
  return collection;
}

module.exports = { listCollections, getCollection, createCollection, updateCollection, deleteCollection, addItem, removeItem };
