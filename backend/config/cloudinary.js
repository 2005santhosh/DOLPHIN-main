const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Force HTTPS
});

// Storage for general uploads (documents, etc.)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'dolphin-uploads',
    allowedFormats: ['jpg', 'png', 'jpeg', 'pdf', 'docx'],
    public_id: (req, file) => {
      return `${Date.now()}-${file.originalname.split('.')[0]}`;
    },
  },
});

// Storage for post media (images and videos) with security and optimization
const postMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    
    return {
      folder: 'dolphin-posts',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo 
        ? ['mp4', 'mov', 'avi', 'mkv', 'webm']
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      public_id: `${req.user._id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      // Security: Add user watermark/context
      context: `user_id=${req.user._id}|uploaded_at=${Date.now()}`,
      // Optimization for images
      transformation: isVideo ? [
        { quality: 'auto', fetch_format: 'auto' },
        { duration: 60 } // Max 60 seconds for videos
      ] : [
        { quality: 'auto:good', fetch_format: 'auto' },
        { width: 1080, height: 1080, crop: 'limit' } // Max dimensions
      ],
      // Generate thumbnail for videos
      eager: isVideo ? [
        { width: 400, height: 400, crop: 'fill', format: 'jpg', quality: 'auto' }
      ] : undefined,
      eager_async: true
    };
  },
});

// File filter for security
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
  
  if ([...allowedImageTypes, ...allowedVideoTypes].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI, MKV, WebM) are allowed.'), false);
  }
};

// Initialize Multer instances
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for profile pictures (images only)
  },
});

const uploadPostMedia = multer({ 
  storage: postMediaStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
    files: 10 // Max 10 files per post
  }
});

module.exports = { upload, uploadPostMedia, cloudinary };