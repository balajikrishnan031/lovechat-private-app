const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbAll, dbRun } = require('./db');

const JWT_SECRET = 'super_secret_private_chat_app_key_2026';

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Register endpoint
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailDomain = email.split('@')[1] ? email.split('@')[1].toLowerCase() : '';

    // Check allowed domains
    const allowedDomain = await dbGet('SELECT * FROM allowed_domains WHERE domain = ?', [emailDomain]);
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');

    let role = 'user';
    let status = 'pending';

    // First user is automatically Admin & Approved
    if (userCount.count === 0) {
      role = 'admin';
      status = 'approved';
    } else if (allowedDomain) {
      status = 'approved'; // Auto-approve if email domain is in whitelist
    }

    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=ff4d6d`;

    const result = await dbRun(
      `INSERT INTO users (username, email, password, avatar, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email.toLowerCase(), hashedPassword, avatarUrl, role, status]
    );

    const newUser = await dbGet('SELECT id, username, email, role, status, avatar FROM users WHERE id = ?', [result.lastID]);

    if (status === 'pending') {
      return res.status(201).json({
        message: 'Registration successful! Account is pending admin approval.',
        status: 'pending',
        user: newUser,
      });
    }

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role, status: newUser.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      status: 'approved',
      token,
      user: newUser,
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Registration failed server error' });
  }
};

// Login endpoint
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending admin approval.', status: 'pending' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Your account has been blocked by the admin.', status: 'blocked' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
    };

    res.json({ token, user: userProfile });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Login server error' });
  }
};

// Get current user profile
const getMe = async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, email, avatar, role, status, online, last_seen FROM users WHERE id = ?', [
      req.user.id,
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// List approved users
const getUsers = async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT id, username, email, avatar, role, status, online, last_seen FROM users WHERE status = 'approved' AND id != ?`,
      [req.user.id]
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Admin: Get pending users
const getPendingUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const pending = await dbAll(`SELECT id, username, email, created_at FROM users WHERE status = 'pending'`);
    const allUsers = await dbAll(`SELECT id, username, email, role, status, created_at FROM users`);
    res.json({ pending, allUsers });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin: Approve or Reject user
const approveUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { userId, status } = req.body; // status: 'approved' | 'blocked'
    if (!userId || !['approved', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    await dbRun('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    res.json({ message: `User status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin: Manage allowed email domains
const getDomains = async (req, res) => {
  try {
    const domains = await dbAll('SELECT * FROM allowed_domains');
    res.json(domains);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const addDomain = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { domain, description } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain is required' });

    await dbRun('INSERT OR REPLACE INTO allowed_domains (domain, description) VALUES (?, ?)', [
      domain.toLowerCase().trim(),
      description || 'College domain',
    ]);
    res.json({ message: 'Domain added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  register,
  login,
  getMe,
  getUsers,
  getPendingUsers,
  approveUser,
  getDomains,
  addDomain,
  JWT_SECRET,
};
