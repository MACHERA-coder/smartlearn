const mysql = require('mysql2/promise');

async function fixDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'mysql-a3904cc-macherastephano-c3fe.l.aivencloud.com',
      port: 16345,
      user: 'avnadmin',
      password: 'WEKA_PASSWORD_YAKO_HAPA',
      database: 'defaultdb',
      ssl: {}
    });

    console.log('Connected to Aiven MySQL');

    await connection.query(`
      ALTER TABLE students
      ADD COLUMN student_id VARCHAR(50) UNIQUE
    `);

    console.log('student_id column added');

    await connection.query(`
      ALTER TABLE students
      ADD COLUMN region VARCHAR(100)
    `);

    console.log('region column added');

    console.log('Students table updated successfully');

    await connection.end();

  } catch (error) {
    console.error('Database fix error:', error);
  }
}

fixDatabase();