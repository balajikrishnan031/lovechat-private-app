const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'chat_database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'pending',
      college TEXT,
      online INTEGER DEFAULT 0,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chats table (Direct or Group)
  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'direct',
      name TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chat Members
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, user_id),
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'text',
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      reply_to_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users (id)
    )
  `);

  // Message Receipts (Delivered / Seen)
  db.run(`
    CREATE TABLE IF NOT EXISTS message_receipts (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'delivered',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
    )
  `);

  // Call Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      type TEXT DEFAULT 'video',
      status TEXT DEFAULT 'completed',
      duration INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caller_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id)
    )
  `);

  // Allowed Email Domains (for auto-approval whitelist)
  db.run(`
    CREATE TABLE IF NOT EXISTS allowed_domains (
      domain TEXT PRIMARY KEY,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default allowed private domain
  db.run(`INSERT OR IGNORE INTO allowed_domains (domain, description) VALUES ('private.app', 'Private Organization Domain')`);

  // Seed 2 default approved demo users for instant 2-user testing
  const bcrypt = require('bcryptjs');
  const demoPasswordHash = bcrypt.hashSync('123', 10);
  const avatar1 = 'https://api.dicebear.com/7.x/initials/svg?seed=Balaji&backgroundColor=ff4d6d';
  const avatar2 = 'https://api.dicebear.com/7.x/initials/svg?seed=Navaneetham&backgroundColor=ff758f';

  db.run(
    `INSERT OR IGNORE INTO users (id, username, email, password, avatar, role, status) VALUES (1, 'Balaji', 'balaji@private.app', ?, ?, 'admin', 'approved')`,
    [demoPasswordHash, avatar1]
  );
  db.run(
    `INSERT OR IGNORE INTO users (id, username, email, password, avatar, role, status) VALUES (2, 'Navaneetham', 'navaneetham@private.app', ?, ?, 'user', 'approved')`,
    [demoPasswordHash, avatar2]
  );
});

// Helper database promise functions
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
};
