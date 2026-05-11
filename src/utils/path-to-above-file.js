const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Reusable Multer Configurator
 * @param {string} destinationPath - Wo folder jaha files save honi chahiye
 */
const createMulterStorage = (destinationPath) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }
      cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, uniqueName + path.extname(file.originalname));
    },
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  };

  return multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
};

module.exports = createMulterStorage;