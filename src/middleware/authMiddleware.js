const jwt = require("jsonwebtoken");
const JWT_SECRET_KEY = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
    console.log('Authorization Header:', req.headers['authorization']);
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (!token || token == "null") {
        return res.status(403).json({ status: 403, success: false, message: 'Access denied. No token provided.' });
    }
    jwt.verify(token, JWT_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ status: 403, success: false, message: 'Invalid token or expired.' });
        }
        console.log("user", user)
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };