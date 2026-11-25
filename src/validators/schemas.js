const { z } = require("zod");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const hexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Use a hex color like #4F7CAC");
const optionalUrl = z.union([z.string().url("Enter a valid URL").max(2048), z.literal("")]).optional();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[a-zA-Z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(20, "Refresh token is required").max(500),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatar: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  bio: z.string().max(300).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const archiveTypes = ["note", "link", "memory", "video", "image", "document", "book", "movie", "idea", "event"];

const attachmentSchema = z.object({
  url: z.string().url(),
  publicId: z.string().default(""),
  resourceType: z.string().default("auto"),
  format: z.string().default(""),
  bytes: z.number().int().nonnegative().default(0),
  originalName: z.string().max(255).default(""),
});

const archiveBody = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  content: z.string().max(100000).optional(),
  type: z.enum(archiveTypes),
  category: z.union([objectId, z.null()]).optional(),
  tags: z.array(z.union([objectId, z.string().trim().min(1).max(30)])).max(20).optional(),
  sourceUrl: optionalUrl,
  attachments: z.array(attachmentSchema).max(10).optional(),
  isFavorite: z.boolean().optional(),
  reminderAt: z.union([z.coerce.date(), z.null()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

const createArchiveSchema = z.object(archiveBody);
const updateArchiveSchema = z.object(archiveBody).partial().refine((data) => Object.keys(data).length > 0, {
  message: "Nothing to update",
});

const archiveQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  q: z.string().trim().max(200).optional(),
  type: z.enum(archiveTypes).optional(),
  category: objectId.optional(),
  tag: z.string().trim().max(30).optional(),
  favorite: z.enum(["true", "false"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["newest", "oldest", "title", "updated"]).optional(),
});

const timelineQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  type: z.enum(archiveTypes).optional(),
  category: objectId.optional(),
  dateField: z.enum(["createdAt", "memoryDate"]).optional(),
});

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color: hexColor.optional(),
});

const categoryUpdateSchema = z
  .object({ name: z.string().trim().min(1).max(40).optional(), color: hexColor.optional() })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

const tagCreateSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(30) });

const collectionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().max(500).optional(),
  color: hexColor.optional(),
  items: z.array(objectId).max(200).optional(),
});

const collectionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    color: hexColor.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

const collectionItemSchema = z.object({ archiveId: objectId });

const reminderCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  note: z.string().max(1000).optional(),
  remindAt: z.coerce.date(),
  archive: z.union([objectId, z.null()]).optional(),
});

const reminderUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    note: z.string().max(1000).optional(),
    remindAt: z.coerce.date().optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

const reminderQuerySchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
  upcoming: z.enum(["true", "false"]).optional(),
});

module.exports = {
  objectId,
  archiveTypes,
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
  createArchiveSchema,
  updateArchiveSchema,
  archiveQuerySchema,
  timelineQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  tagCreateSchema,
  collectionCreateSchema,
  collectionUpdateSchema,
  collectionItemSchema,
  reminderCreateSchema,
  reminderUpdateSchema,
  reminderQuerySchema,
};
