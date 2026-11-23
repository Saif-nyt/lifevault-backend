const mongoose = require("mongoose");
const { z } = require("zod");
const Archive = require("../models/Archive");
const Category = require("../models/Category");
const Tag = require("../models/Tag");
const Reminder = require("../models/Reminder");
const Collection = require("../models/Collection");
const { ApiError } = require("../utils/ApiError");
const { escapeRegex, parsePagination, buildMeta } = require("../utils/http");
const { resolveTags } = require("./taxonomy.service");

const isoDate = z
  .union([z.string().min(1), z.coerce.date()])
  .transform((value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
    return date.toISOString();
  });

const metadataSchemas = {
  note: z.object({}).strict(),
  link: z.object({}).strict(),
  document: z.object({}).strict(),
  image: z.object({ location: z.string().max(200).optional(), takenAt: isoDate.optional() }).strict(),
  video: z
    .object({ channel: z.string().max(200).optional(), duration: z.string().max(40).optional() })
    .strict(),
  memory: z
    .object({ memoryDate: isoDate.optional(), location: z.string().max(200).optional() })
    .strict(),
  event: z.object({ eventDate: isoDate.optional(), location: z.string().max(200).optional() }).strict(),
  book: z
    .object({
      author: z.string().max(200).optional(),
      status: z.enum(["want-to-read", "reading", "completed"]).optional(),
      rating: z.number().min(0).max(5).optional(),
      notes: z.string().max(5000).optional(),
    })
    .strict(),
  movie: z
    .object({
      genre: z.string().max(120).optional(),
      director: z.string().max(200).optional(),
      year: z.number().int().min(1880).max(2200).optional(),
      status: z.enum(["to-watch", "watching", "watched"]).optional(),
      rating: z.number().min(0).max(5).optional(),
      review: z.string().max(5000).optional(),
    })
    .strict(),
  idea: z
    .object({
      priority: z.enum(["low", "medium", "high"]).optional(),
      status: z.enum(["draft", "exploring", "implemented", "archived"]).optional(),
    })
    .strict(),
};

function validateMetadata(type, metadata = {}) {
  const schema = metadataSchemas[type];
  const result = schema.safeParse(metadata || {});
  if (!result.success) {
    throw new ApiError(
      400,
      `Invalid metadata for ${type}`,
      result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    );
  }
  return result.data;
}

function serializeArchive(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    ...obj,
    id: String(obj._id),
    category:
      obj.category && typeof obj.category === "object" && obj.category._id
        ? { ...obj.category, id: String(obj.category._id) }
        : obj.category || null,
    tags: (obj.tags || []).map((tag) =>
      tag && typeof tag === "object" && tag._id ? { ...tag, id: String(tag._id) } : tag
    ),
  };
}

function populateArchive(query) {
  return query.populate("category", "name color").populate("tags", "name");
}

async function assertCategory(userId, categoryId) {
  if (categoryId === null || categoryId === undefined) return null;
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) throw new ApiError(400, "Category not found");
  return category._id;
}

async function syncArchiveReminder(userId, archive, reminderAt) {
  if (reminderAt) {
    await Reminder.findOneAndUpdate(
      { user: userId, archive: archive._id, source: "archive" },
      {
        $set: { title: archive.title, remindAt: reminderAt, note: archive.description || "" },
        $setOnInsert: { completed: false, completedAt: null },
      },
      { upsert: true, new: true, runValidators: true }
    );
  } else {
    await Reminder.deleteMany({ user: userId, archive: archive._id, source: "archive" });
  }
}

async function createArchive(userId, data) {
  const categoryId = await assertCategory(userId, data.category);
  const { ids, names } = await resolveTags(userId, data.tags || []);
  const metadata = validateMetadata(data.type, data.metadata);

  const archive = await Archive.create({
    user: userId,
    title: data.title,
    description: data.description || "",
    content: data.content || "",
    type: data.type,
    category: categoryId,
    tags: ids,
    tagNames: names,
    sourceUrl: data.sourceUrl || "",
    attachments: data.attachments || [],
    isFavorite: data.isFavorite || false,
    reminderAt: data.reminderAt || null,
    metadata,
  });

  await syncArchiveReminder(userId, archive, archive.reminderAt);
  return serializeArchive(await populateArchive(Archive.findById(archive._id)));
}

function buildArchiveFilter(userId, query) {
  const filter = { user: userId };

  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.favorite !== undefined) filter.isFavorite = query.favorite === "true";

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [
      { title: regex },
      { description: regex },
      { content: regex },
      { sourceUrl: regex },
      { tagNames: regex },
    ];
  }

  return filter;
}

async function listArchives(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = buildArchiveFilter(userId, query);

  if (query.tag) {
    const tag = /^[a-f\d]{24}$/i.test(query.tag)
      ? await Tag.findOne({ _id: query.tag, user: userId })
      : await Tag.findOne({ user: userId, nameKey: query.tag.toLowerCase() });
    if (!tag) {
      return { items: [], meta: buildMeta({ page, limit, total: 0 }) };
    }
    filter.tags = tag._id;
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    title: { title: 1 },
    updated: { updatedAt: -1 },
  };

  const [docs, total] = await Promise.all([
    populateArchive(Archive.find(filter))
      .sort(sortMap[query.sort] || sortMap.newest)
      .skip(skip)
      .limit(limit)
      .collation({ locale: "en", strength: 1 }),
    Archive.countDocuments(filter),
  ]);

  return { items: docs.map(serializeArchive), meta: buildMeta({ page, limit, total }) };
}

async function getArchive(userId, archiveId) {
  const archive = await populateArchive(Archive.findOne({ _id: archiveId, user: userId }));
  if (!archive) throw new ApiError(404, "Archive item not found");
  return serializeArchive(archive);
}

async function updateArchive(userId, archiveId, data) {
  const archive = await Archive.findOne({ _id: archiveId, user: userId });
  if (!archive) throw new ApiError(404, "Archive item not found");

  if (data.category !== undefined) archive.category = await assertCategory(userId, data.category);

  if (data.tags !== undefined) {
    const { ids, names } = await resolveTags(userId, data.tags);
    archive.tags = ids;
    archive.tagNames = names;
  }

  if (data.metadata !== undefined) {
    const type = data.type || archive.type;
    archive.metadata = validateMetadata(type, { ...archive.metadata, ...data.metadata });
  }

  for (const field of ["title", "description", "content", "type", "sourceUrl", "attachments", "isFavorite", "reminderAt"]) {
    if (data[field] !== undefined) archive[field] = data[field];
  }

  await archive.save();
  await syncArchiveReminder(userId, archive, archive.reminderAt);
  return serializeArchive(await populateArchive(Archive.findById(archive._id)));
}

async function toggleFavorite(userId, archiveId) {
  const archive = await Archive.findOne({ _id: archiveId, user: userId });
  if (!archive) throw new ApiError(404, "Archive item not found");
  archive.isFavorite = !archive.isFavorite;
  await archive.save();
  return serializeArchive(await populateArchive(Archive.findById(archive._id)));
}

async function deleteArchive(userId, archiveId) {
  const archive = await Archive.findOneAndDelete({ _id: archiveId, user: userId });
  if (!archive) throw new ApiError(404, "Archive item not found");

  await Promise.all([
    Reminder.deleteMany({ user: userId, archive: archive._id, source: "archive" }),
    Collection.updateMany({ user: userId }, { $pull: { items: archive._id } }),
  ]);

  return archive;
}

async function getTimeline(userId, query) {
  const now = new Date();
  const year = query.year || now.getFullYear();
  const dateField = query.dateField || "createdAt";

  const filter = { user: userId };
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;

  const pad = (value) => String(value).padStart(2, "0");
  if (dateField === "memoryDate") {
    const prefix = query.month ? `${year}-${pad(query.month)}` : `${year}`;
    filter["metadata.memoryDate"] = { $regex: `^${prefix}` };
  } else {
    const start = new Date(Date.UTC(year, query.month ? query.month - 1 : 0, 1));
    const end = query.month
      ? new Date(Date.UTC(year, query.month, 1))
      : new Date(Date.UTC(year + 1, 0, 1));
    filter.createdAt = { $gte: start, $lt: end };
  }

  const docs = await populateArchive(Archive.find(filter))
    .sort({ createdAt: -1 })
    .limit(500);

  const items = docs.map(serializeArchive).sort((a, b) => {
    const dateA = new Date(a.metadata?.memoryDate || a.metadata?.eventDate || a.createdAt);
    const dateB = new Date(b.metadata?.memoryDate || b.metadata?.eventDate || b.createdAt);
    return dateB - dateA;
  });

  const years = await Archive.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: { $year: "$createdAt" } } },
    { $sort: { _id: -1 } },
  ]);

  const memoryYears = await Archive.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), "metadata.memoryDate": { $type: "string" } } },
    { $group: { _id: { $substrBytes: ["$metadata.memoryDate", 0, 4] } } },
    { $sort: { _id: -1 } },
  ]);

  const availableYears = Array.from(
    new Set([...years.map((y) => y._id), ...memoryYears.map((y) => Number(y._id)), year])
  )
    .filter(Boolean)
    .sort((a, b) => b - a);

  return { items, year, month: query.month || null, dateField, availableYears };
}

module.exports = {
  createArchive,
  listArchives,
  getArchive,
  updateArchive,
  toggleFavorite,
  deleteArchive,
  getTimeline,
  serializeArchive,
  validateMetadata,
};
