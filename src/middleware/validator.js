// const CoustomError = require('../utils/CoustomError');

// const validateBody = (requiredFields) => {
//     return (req, res, next) => {
//         try {
//             console.log("req.body", req.body)
//             if (!req.body || Object.keys(req.body).length === 0) {
//                 throw new CoustomError('Request body is missing or empty', 400);
//             }
//             console.log("requiredFields", requiredFields)
//             for (const field of requiredFields) {
//                 const value = req.body[field];
//                 if (value === undefined || value === null || value.toString().trim() === "") {
//                     throw new CoustomError(`${field} is required and cannot be empty`, 400);
//                 }
//             }
//             next();
//         } catch (error) {
//             next(error);
//         }
//     };
// };

// module.exports = validateBody;


// const fs = require('fs');
// const CoustomError = require('../utils/CoustomError');

// const validateBody = (requiredFields) => {
//     return (req, res, next) => {
//         try {
//             if (!req.body || Object.keys(req.body).length === 0) {
//                 if (req.file) fs.unlinkSync(req.file.path);
//                 throw new CoustomError('Request body is missing or empty', 400);
//             }

//             for (const field of requiredFields) {
//                 const value = req.body[field];
//                 if (value === undefined || value === null || value.toString().trim() === "") {
//                     // if (req.file) fs.unlinkSync(req.file.path);
//                     throw new CoustomError(`${field} is required and cannot be empty`, 400);
//                 }
//             }
//             next();
//         } catch (error) {
//             // if (req.file) fs.unlinkSync(req.file.path); 
//             if (req.file && fs.existsSync(req.file.path)) {
//                 fs.unlinkSync(req.file.path);
//             }
//             next(error);
//         }
//     };
// };

// module.exports = validateBody;






const fs = require('fs');
const CoustomError = require('../utils/CoustomError');

const validateBody = (requiredFields) => {
    return (req, res, next) => {
        try {
            // Check if body exists
            if (!req.body || Object.keys(req.body).length === 0) {
                throw new CoustomError('Request body is missing or empty', 400);
            }

            // Required fields check
            for (const field of requiredFields) {
                const value = req.body[field];
                // Check for null, undefined or empty string (even after trim)
                if (value === undefined || value === null || String(value).trim() === "") {
                    throw new CoustomError(`${field} is required`, 400);
                }
            }
            next();
        } catch (error) {
            // CLEANUP: Agar validation fail ho aur file upload ho chuki ho
            if (req.file && req.file.path) {
                try {
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                } catch (fsErr) {
                    console.error("File cleanup error:", fsErr);
                }
            }
            next(error); // Global handler ko bhej dein
        }
    };
};

module.exports = validateBody;