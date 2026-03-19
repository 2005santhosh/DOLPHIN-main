const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'dolphin-uploads', // The name of the folder in your Cloudinary dashboard
    allowedFormats: ['jpg', 'png', 'jpeg', 'pdf', 'docx'], // Allowed file types
    public_id: (req, file) => {
      // Generate a unique filename
      return `${Date.now()}-${file.originalname.split('.')[0]}`;
    },
  },
});

// Initialize Multer with the Cloudinary storage engine samesite
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };