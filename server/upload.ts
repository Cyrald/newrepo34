import multer from "multer";
import path from "path";

const memoryStorage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    cb(new Error("Недопустимое расширение файла"));
    return;
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error("Недопустимый MIME тип"));
    return;
  }
  
  cb(null, true);
};

export const productImagesUpload = multer({
  storage: memoryStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});

export const chatAttachmentsUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 7,
  },
  fileFilter,
});

export const productFormDataUpload = multer({
  storage: memoryStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});
