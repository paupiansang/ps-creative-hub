const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const secret = process.env.JWT_SECRET || "dev-only-change-me";

function signUser(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: "7d" });
}
function verifyToken(token) {
  return jwt.verify(token, secret);
}
function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function requireAuth(req, res, next) {
  const token = req.cookies.ps_token;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
module.exports = { signUser, verifyToken, hashPassword, comparePassword, requireAuth, requireAdmin };
