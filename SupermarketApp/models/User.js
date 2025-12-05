const db = require('../db');

const User = {
    create(data, callback) {
        const sql = `
            INSERT INTO users (username, email, password, address, contact, role)
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;
        db.query(sql, [
            data.username,
            data.email,
            data.password,
            data.address,
            data.contact,
            data.role || 'user'
        ], callback);
    },

    findByEmailAndPassword(email, password, callback) {
        const sql = `
            SELECT * FROM users
            WHERE email = ? AND password = SHA1(?)
        `;
        db.query(sql, [email, password], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows[0] || null);
        });
    },

    getAll(callback) {
        const sql = `SELECT id, username, email, role FROM users`;
        db.query(sql, callback);
    }
};

module.exports = User;
