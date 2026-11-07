import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { tmpdir } from "node:os";

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const storageTypes = [...imageTypes, "application/pdf"];

function diskUpload(fieldName: string, allowedTypes: string[]) {
  const upload = multer({
    storage: multer.diskStorage({ destination: tmpdir() }),
    limits: { files: 1 },
    fileFilter: (_req, file, callback) => {
      if (allowedTypes.includes(file.mimetype)) callback(null, true);
      else callback(new Error(`Only ${allowedTypes.join(", ")} files are accepted`));
    },
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single(fieldName)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        res.status(400).json({ msg: error.message });
        return;
      }
      if (error) {
        res.status(415).json({ msg: error instanceof Error ? error.message : "Invalid file" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ msg: `Choose a ${fieldName} to upload` });
        return;
      }
      next();
    });
  };
}

export const uploadStorageFile = diskUpload("file", storageTypes);
export default diskUpload("image", imageTypes);
