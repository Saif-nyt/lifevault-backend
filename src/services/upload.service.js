const cloudinary = require("cloudinary").v2;
const env = require("../config/env");
const Upload = require("../models/Upload");
const Archive = require("../models/Archive");
const { ApiError } = require("../utils/ApiError");

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function assertConfigured() {
  if (!env.cloudinaryEnabled) {
    throw new ApiError(
      503,
      "File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the backend."
    );
  }
}

function uploadBuffer(buffer, filename, mimetype) {
  assertConfigured();

  return new Promise((resolve, reject) => {
    const resourceType = mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "lifevault",
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
      },
      (error, result) => {
        if (error) return reject(new ApiError(502, "Upload to file storage failed"));
        resolve({ result, resourceType });
      }
    );
    stream.end(buffer);
  });
}

async function uploadFile(userId, file) {
  if (!file) throw new ApiError(400, "No file provided");
  const { result, resourceType } = await uploadBuffer(file.buffer, file.originalname, file.mimetype);

  const upload = await Upload.create({
    user: userId,
    url: result.secure_url,
    publicId: result.public_id,
    resourceType,
    format: result.format || "",
    bytes: result.bytes || file.size,
    originalName: file.originalname,
  });

  return upload.toObject();
}

async function deleteUpload(userId, uploadId) {
  const upload = await Upload.findOne({ _id: uploadId, user: userId });
  if (!upload) throw new ApiError(404, "Upload not found");

  assertConfigured();
  try {
    await cloudinary.uploader.destroy(upload.publicId, { resource_type: upload.resourceType });
  } catch {
    throw new ApiError(502, "Could not delete file from storage");
  }

  await Archive.updateMany({ user: userId }, { $pull: { attachments: { publicId: upload.publicId } } });
  await upload.deleteOne();
  return upload;
}

module.exports = { uploadFile, deleteUpload };
