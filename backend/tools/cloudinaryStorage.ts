import { createReadStream } from "node:fs";
import cloudinary from "../config/cloudinary.js";

export interface CloudinaryAsset {
  secure_url: string;
  public_id: string;
  resource_type: "image" | "raw" | "video";
  format: string;
  deliveryType: "upload" | "authenticated";
  bytes: number;
}

export function uploadLocalFile(
  path: string,
  options: {
    folder: string;
    resource_type: "auto" | "image";
    public_id?: string;
    overwrite?: boolean;
    type?: "upload" | "authenticated";
  },
): Promise<CloudinaryAsset> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Cloudinary upload failed"));
        return;
      }
      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type as CloudinaryAsset["resource_type"],
        format: result.format,
        deliveryType: options.type ?? "upload",
        bytes: result.bytes,
      });
    });
    createReadStream(path).on("error", reject).pipe(upload);
  });
}

export async function deleteCloudinaryAsset(asset: Pick<CloudinaryAsset, "public_id" | "resource_type" | "deliveryType">): Promise<void> {
  await cloudinary.uploader.destroy(asset.public_id, {
    resource_type: asset.resource_type,
    type: asset.deliveryType,
    invalidate: true,
  });
}

export function createTemporaryDownloadUrl(asset: {
  public_id: string;
  resource_type: CloudinaryAsset["resource_type"];
  format: string;
  deliveryType: CloudinaryAsset["deliveryType"];
}): { url: string; expiresAt: Date } {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
  return {
    url: cloudinary.utils.private_download_url(asset.public_id, asset.format, {
      resource_type: asset.resource_type,
      type: asset.deliveryType,
      expires_at: expiresAtSeconds,
      attachment: true,
    }),
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}
