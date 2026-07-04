import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import multer from 'multer';
import { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

export class FileHandler {
  private servicePort: string | number;

  constructor() {
    this.ensureUploadsDirectory();
    // Return direct MediaSoup service URL to avoid proxy CORS issues
    this.servicePort = process.env.PORT || 3003;
  }

  ensureUploadsDirectory() {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  handleUpload(req: Request, res: Response) {
    const filename = decodeURIComponent(req.url.split('/uploads/')[1]);

    // Use multer to handle FormData
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      if (!(req as any).file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = path.join(uploadsDir, filename);

      // Write the file to disk
      fs.writeFile(filePath, (req as any).file.buffer, (err) => {
        if (err) {
          console.error('File write error:', err);
          return res.status(500).json({ error: 'Upload failed' });
        }

        res.status(200).json({
          url: `http://localhost:${this.servicePort}/uploads/${filename}`,
          success: true,
        });
      });
    });
  }

  handleFileServe(req: Request, res: Response) {
    const filename = decodeURIComponent(req.url.split('/uploads/')[1]);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set CORS headers BEFORE sending file
    res.header(
      'Access-Control-Allow-Origin',
      process.env.CORS_ORIGIN || 'http://localhost:5174'
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Cache-Control', 'public, max-age=31536000');

    // Use Express sendFile for proper file serving
    const options = {
      root: uploadsDir,
      dotfiles: 'deny' as 'deny' | 'allow' | 'ignore',
    };

    res.sendFile(filename, options, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve file' });
        }
      }
    });
  }
}
