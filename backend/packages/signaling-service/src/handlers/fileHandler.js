import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

export class FileHandler {
  constructor() {
    this.ensureUploadsDirectory();
    this.serverPort = process.env.PORT || 5002;
  }

  ensureUploadsDirectory() {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  handleUpload(req, res) {
    const filename = req.url.split('/uploads/')[1];

    // Set CORS headers for upload response
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.CORS_ORIGIN || '*'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Use multer to handle FormData
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload failed' }));
        return;
      }

      if (!req.file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No file uploaded' }));
        return;
      }

      const filePath = path.join(uploadsDir, filename);

      // Write the file to disk
      fs.writeFile(filePath, req.file.buffer, (err) => {
        if (err) {
          console.error('File write error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Upload failed' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              url: `http://localhost:${this.serverPort}/uploads/${filename}`,
              success: true,
            })
          );
        }
      });
    });
  }

  handleFileServe(req, res) {
    const filename = req.url.split('/uploads/')[1];
    const filePath = path.join(uploadsDir, filename);

    // Set CORS headers for file serving
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.CORS_ORIGIN || '*'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);

      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';

      if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.gif') {
        contentType = 'image/gif';
      } else if (ext === '.webp') {
        contentType = 'image/webp';
      } else if (ext === '.svg') {
        contentType = 'image/svg+xml';
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
  }
}
