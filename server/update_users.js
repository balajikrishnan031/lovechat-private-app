const { dbRun, dbAll } = require('./db');

async function updateDb() {
  await dbRun(`DELETE FROM users WHERE username = 'Anitha' OR email = 'anitha@private.app'`);
  await dbRun(`UPDATE users SET avatar = 'https://api.dicebear.com/7.x/initials/svg?seed=Balaji&backgroundColor=ff4d6d' WHERE username = 'Balaji'`);
  await dbRun(`UPDATE users SET avatar = 'https://api.dicebear.com/7.x/initials/svg?seed=Navaneetham&backgroundColor=ff758f' WHERE username = 'Navaneetham'`);

  const updated = await dbAll('SELECT id, username, email, avatar FROM users');
  console.log('Updated DB Users:', updated);
  process.exit(0);
}

updateDb();
