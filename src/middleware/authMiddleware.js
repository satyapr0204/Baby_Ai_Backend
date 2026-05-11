// const jwt = require("jsonwebtoken");
// const JWT_SECRET_KEY = process.env.JWT_SECRET;

// const authenticateToken = (req, res, next) => {
//     console.log('Authorization Header:', req.headers['authorization']);
//     const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
//     if (!token || token == "null") {
//         return res.status(403).json({ status: 403, success: false, message: 'Access denied. No token provided.' });
//     }
//     jwt.verify(token, JWT_SECRET_KEY, (err, user) => {
//         if (err) {
//             return res.status(403).json({ status: 403, success: false, message: 'Invalid token or expired.' });
//         }
//         console.log("user", user)
//         req.user = user;
//         next();
//     });
// };

// module.exports = { authenticateToken };

const jwt = require("jsonwebtoken");
const CoustomError = require("../utils/CoustomError");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  console.log("Authorization Header:", authHeader);
  if (!token || token === "null" || token === "undefined") {
    // 401 is more appropriate for "No Auth"
    // return next(new CoustomError('Access denied. No token provided.', 401));
    return next(new CoustomError("Access denied. No token provided.", 403));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      const msg =
        err.name === "TokenExpiredError"
          ? "Session expired."
          : "Invalid token.";
      return next(new CoustomError(msg, 403));
    }
    console.log("Login user", decodedUser);
    req.user = decodedUser;
    next();
  });
};

module.exports = { authenticateToken };
