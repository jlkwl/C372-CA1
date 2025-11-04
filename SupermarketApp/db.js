// db.js
const mysql = require('mysql2');
require('dotenv').config();

// Create the MySQL connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Republic_C207',
  database: process.env.DB_NAME || 'c372_supermarketdb'
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Export the connection so other files can use it
module.exports = connection;