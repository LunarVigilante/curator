import Database from 'better-sqlite3';

console.log('Testing database connection...');
try {
    const db = new Database('dev.db');
    console.log('Database opened successfully');
    const row = db.prepare('SELECT 1').get();
    console.log('Query result:', row);
} catch (e) {
    console.error('Database error:', e);
}
