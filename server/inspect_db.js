const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables);
  for (const table of tables) {
    const columns = await db.all(`PRAGMA table_info(${table.name})`);
    console.log(`Columns for ${table.name}:`, columns);
  }
  process.exit(0);
})();
