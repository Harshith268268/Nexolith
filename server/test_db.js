const { initializeDb } = require('./database');
(async () => {
  try {
    console.log('Initializing DB...');
    const db = await initializeDb();
    console.log('DB Initialized!');
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables);
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
})();
