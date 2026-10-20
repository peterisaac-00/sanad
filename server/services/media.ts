import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma, newId } from "../db.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";

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
    const target = path.resolve(this.root(), storageKey);
    if (!target.startsWith(this.root())) return;
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

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function storeMedia(input: {
  storeId: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{ media: { id: string; url: string; fileName: string; mimeType: string; size: number } }> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new ApiError(400, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, WebP, GIF and SVG images are supported.");
  }
  if (!mediaStorage.configured) {
    throw new ApiError(503, "STORAGE_INTEGRATION_NOT_CONFIGURED", "Media storage is not configured.");
  }
  const clean = input.dataBase64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) {
    throw new ApiError(400, "INVALID_MEDIA", "Invalid base64 image payload.");
  }
  const bytes = Buffer.from(clean, "base64");
  if (bytes.length === 0) throw new ApiError(400, "INVALID_MEDIA", "The image is empty.");
  if (bytes.length > env.mediaMaxBytes) {
    throw new ApiError(413, "MEDIA_TOO_LARGE", `Image exceeds the ${Math.round(env.mediaMaxBytes / 1024)} KB limit.`);
  }
  const ext = EXT[input.mimeType] ?? "bin";
  const key = path.join(input.storeId, `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`);
  const stored = await mediaStorage.save({ key, bytes, mimeType: input.mimeType });
  const id = newId("media_");
  await prisma.mediaAsset.create({
    data: {
      id,
      storeId: input.storeId,
      fileName: input.fileName.slice(0, 200) || `image.${ext}`,
      mimeType: input.mimeType,
      size: bytes.length,
      url: stored.url,
      storageKey: stored.storageKey,
      provider: stored.provider,
    },
  });
  return { media: { id, url: stored.url, fileName: input.fileName, mimeType: input.mimeType, size: bytes.length } };
}
