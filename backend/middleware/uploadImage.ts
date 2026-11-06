import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Only JPEG, PNG, WebP, or GIF images are accepted"));
    }
  },
});

export default function uploadImage(req: Request, res: Response, next: NextFunction): void {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ msg: error.message });
      return;
    }
    if (error) {
      res.status(415).json({ msg: error instanceof Error ? error.message : "Invalid image" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ msg: "Choose an image to upload" });
      return;
    }
    next();
  });
}
