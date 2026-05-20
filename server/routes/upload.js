import { Router } from 'express';
import multer from 'multer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: resolve(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  }
});

const router = Router();

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
