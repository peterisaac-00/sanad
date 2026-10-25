import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { prisma, newId } from "../db.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { logger } from "../logger.js";

export interface StoredMedia {
  url: string;
  storageKey: string;
  provider: string;
}

export interface MediaStorage {
  readonly provider: string;
  readonly configured: boolean;
  save(input: { key: string; bytes: Buffer; mimeType: string }): Promise<StoredMedia>;
  remove(storageKey: string): Promise<void>;
}

class LocalMediaStorage implements MediaStorage {
  readonly provider = "local";
  readonly configured = true;

  private root() {
    return path.resolve(process.cwd(), env.storageDir);
  }

  async save(input: { key: string; bytes: Buffer }): Promise<StoredMedia> {
    const target = path.join(this.root(), input.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.bytes);
    return {
      url: `/uploads/${input.key.split(path.sep).join("/")}`,
      storageKey: input.key,
      provider: this.provider,
    };
  }

  async remove(storageKey: string): Promise<void> {
    const root = this.root();
    const target = path.resolve(root, storageKey);
    if (!target.startsWith(root)) return;
    await fs.unlink(target).catch(() => undefined);
  }
}

class S3MediaStorage implements MediaStorage {
  readonly provider = "s3";
  readonly configured = false;
  async save(): Promise<StoredMedia> {
    throw new ApiError(
      503,
      "STORAGE_INTEGRATION_NOT_CONFIGURED",
      "تخزين S3 غير مهيأ. استخدم STORAGE_DRIVER=local حالياً أو أضف محوّل S3 وبيانات الاعتماد."
    );
  }
  async remove(): Promise<void> {}
}

export const mediaStorage: MediaStorage =
  env.storageDriver === "s3" ? new S3MediaStorage() : new LocalMediaStorage();

/**
 * Active content is never accepted. SVG is rejected outright (it can execute
 * script even when served with an image content type), and GIF support is
 * retained only through a full decode/re-encode pipeline.
 */
const DECLARED_MIME: Record<string, { format: "jpeg" | "png" | "webp" | "gif"; ext: string; mime: string }> = {
  "image/jpeg": { format: "jpeg", ext: "jpg", mime: "image/jpeg" },
  "image/jpg": { format: "jpeg", ext: "jpg", mime: "image/jpeg" },
  "image/png": { format: "png", ext: "png", mime: "image/png" },
  "image/webp": { format: "webp", ext: "webp", mime: "image/webp" },
  "image/gif": { format: "gif", ext: "gif", mime: "image/gif" },
};

export const UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function decodeBase64(input: string): Buffer {
  const clean = input.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new ApiError(400, "INVALID_MEDIA", "Invalid base64 image payload.");
  }
  // Reject payloads that decode to a different byte length than the strict
  // base64 representation would imply (guards against permissive decoding).
  const bytes = Buffer.from(clean, "base64");
  if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== clean.replace(/=+$/, "")) {
    throw new ApiError(400, "INVALID_MEDIA", "Invalid base64 image payload.");
  }
  return bytes;
}

function detectSignature(bytes: Buffer): "jpeg" | "png" | "webp" | "gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.length >= 6 && (bytes.toString("ascii", 0, 6) === "GIF87a" || bytes.toString("ascii", 0, 6) === "GIF89a")) {
    return "gif";
  }
  return null;
}

/**
 * Validate real content, decode every frame, re-encode to strip metadata and
 * any trailing polyglot payload, and enforce size/dimension limits.
 */
async function normalizeImage(input: { declaredMime: string; bytes: Buffer }) {
  const declared = DECLARED_MIME[input.declaredMime.toLowerCase()];
  if (!declared) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, WebP and GIF images are accepted.");
  }
  if (input.bytes.length > env.mediaMaxBytes) {
    throw new ApiError(413, "MEDIA_TOO_LARGE", `Image exceeds the ${Math.round(env.mediaMaxBytes / 1024)} KB limit.`);
  }
  const signature = detectSignature(input.bytes);
  if (!signature) {
    throw new ApiError(415, "INVALID_MEDIA_SIGNATURE", "The uploaded file is not a valid image.");
  }
  if (signature !== declared.format) {
    throw new ApiError(415, "MEDIA_TYPE_MISMATCH", "The file content does not match its declared image type.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.bytes, {
      animated: declared.format === "gif",
      failOn: "error",
      limitInputPixels: env.mediaMaxDimension * env.mediaMaxDimension,
    }).metadata();
  } catch {
    throw new ApiError(415, "INVALID_MEDIA", "The image could not be decoded.");
  }
  if (!metadata.width || !metadata.height || metadata.format !== declared.format) {
    throw new ApiError(415, "INVALID_MEDIA", "The image could not be decoded.");
  }
  if (metadata.width > env.mediaMaxDimension || metadata.height > env.mediaMaxDimension) {
    throw new ApiError(
      413,
      "MEDIA_DIMENSIONS_TOO_LARGE",
      `Image dimensions must not exceed ${env.mediaMaxDimension}×${env.mediaMaxDimension}px.`
    );
  }
  if ((metadata.pages ?? 1) > 300) {
    throw new ApiError(413, "MEDIA_TOO_MANY_FRAMES", "Animated images may not exceed 300 frames.");
  }

  let pipeline = sharp(input.bytes, {
    animated: declared.format === "gif",
    failOn: "error",
    limitInputPixels: env.mediaMaxDimension * env.mediaMaxDimension,
  }).rotate();
  if (declared.format === "jpeg") pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  else if (declared.format === "png") pipeline = pipeline.png({ compressionLevel: 9 });
  else if (declared.format === "webp") pipeline = pipeline.webp({ quality: 85 });
  else pipeline = pipeline.gif();

  let output: Buffer;
  try {
    output = await pipeline.toBuffer();
  } catch (err) {
    logger.warn({ err }, "image re-encode failed");
    throw new ApiError(415, "INVALID_MEDIA", "The image could not be processed.");
  }
  if (output.length > env.mediaMaxBytes) {
    throw new ApiError(413, "MEDIA_TOO_LARGE", `Processed image exceeds the ${Math.round(env.mediaMaxBytes / 1024)} KB limit.`);
  }
  if (detectSignature(output) !== declared.format) {
    throw new ApiError(415, "INVALID_MEDIA", "The image could not be processed.");
  }
  return {
    bytes: output,
    mimeType: declared.mime,
    ext: declared.ext,
    width: metadata.width,
    height: metadata.height,
  };
}

function safeFileName(input: string, ext: string): string {
  const base = path.basename(String(input ?? "")).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "").trim().slice(0, 190);
  return base || `image.${ext}`;
}

export async function storeMedia(input: {
  storeId: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{
  media: {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
  };
}> {
  if (!mediaStorage.configured) {
    throw new ApiError(503, "STORAGE_INTEGRATION_NOT_CONFIGURED", "Media storage is not configured.");
  }
  const decoded = decodeBase64(input.dataBase64);
  const normalized = await normalizeImage({ declaredMime: input.mimeType, bytes: decoded });
  const key = path.join(input.storeId, `${Date.now()}-${randomBytes(6).toString("hex")}.${normalized.ext}`);
  const stored = await mediaStorage.save({ key, bytes: normalized.bytes, mimeType: normalized.mimeType });
  const id = newId("media_");
  const fileName = safeFileName(input.fileName, normalized.ext);
  try {
    await prisma.mediaAsset.create({
      data: {
        id,
        storeId: input.storeId,
        fileName,
        mimeType: normalized.mimeType,
        size: normalized.bytes.length,
        url: stored.url,
        storageKey: stored.storageKey,
        provider: stored.provider,
        width: normalized.width,
        height: normalized.height,
      },
    });
  } catch (error) {
    await mediaStorage.remove(stored.storageKey);
    logger.warn({ error, storageKey: stored.storageKey }, "removed media file after database write failure");
    throw error;
  }
  return {
    media: {
      id,
      url: stored.url,
      fileName,
      mimeType: normalized.mimeType,
      size: normalized.bytes.length,
      width: normalized.width,
      height: normalized.height,
    },
  };
}

export async function responsiveMedia(storageKey: string, width: number): Promise<Buffer | null> {
  const root = path.resolve(process.cwd(), env.storageDir);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`)) return null;
  try {
    const source = await fs.readFile(target);
    return await sharp(source, { failOn: "error", limitInputPixels: env.mediaMaxDimension * env.mediaMaxDimension })
      .resize({ width: Math.max(160, Math.min(1600, Math.round(width))), withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

export { detectSignature, normalizeImage };
