import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";

// Sử dụng memoryStorage như cũ
const storage = multer.memoryStorage();

// Middleware upload file
const upload_file = multer({
    storage: storage,
    limits: { fieldNameSize: 1024 * 1024 * 5 },
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const fileTypes = /jpeg|jpg|png/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        return cb(new Error("Chỉ nhấp nhận file ảnh JPG, PNG, JPEG"));
    }
});

export const upload_file_message = multer({
    storage: storage,
    limits: { fieldNameSize: 1024 * 1024 * 20 },
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        return cb(null, true);
    }
});

export default upload_file;
