import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const app = express();
const PORT = 3000;

// Multer setup for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function startServer() {
  console.log('--- Environment Check ---');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING');
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING');
  console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING');
  
  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME });
  });

// Cloudinary Upload Endpoint
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    console.log('--- Upload Request ---');
    console.log('File received:', !!req.file);
    if (req.file) {
      console.log('Mimetype:', req.file.mimetype);
      console.log('Size:', req.file.size);
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.error('Cloudinary environment variables missing');
        return res.status(500).json({ 
          error: 'Cloudinary credentials missing in environment. Please check Secrets.' 
        });
      }

      // Use a Promise to handle the upload stream
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: 'devjournal'
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary Stream Error:', error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        // Pipe the buffer to the stream
        uploadStream.end(req.file.buffer);
      });

      const result: any = await uploadPromise;
      console.log('Upload successful:', result.secure_url);
      res.json({ url: result.secure_url });
    } catch (error: any) {
      console.error('Upload handler error:', error);
      res.status(500).json({ error: error.message || 'Cloudinary upload failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
