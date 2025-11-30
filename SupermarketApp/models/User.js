const db = require('../db');

const User = {
    create: (userData, callback) => {
        const name = userData.username || userData.name || null;
        const email = userData.email;
        const password = userData.password;
        const role = userData.role || 'user';

        if (!name || !email || !password) {
            const err = new Error('Missing required user fields');
            console.error(err);
            return callback(err);
        }

        const sql = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        const params = [name, email, password, role];

        db.query(sql, params, (err, result) => {
            if (err) {
                console.error('User.create error:', err);
                return callback(err);
            }
            return callback(null, result);
        });
    },

    findByEmailAndPassword: (email, password, callback) => {
        const sql = 'SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1';
        db.query(sql, [email, password], (err, results) => {
            if (err) {
                console.error('User.findByEmailAndPassword error:', err);
                return callback(err);
            }
            if (!results || results.length === 0) return callback(null, null);
            return callback(null, results[0]);
        });
    },

    findById: (userId, callback) => {
        const sql = 'SELECT * FROM users WHERE userId = ? LIMIT 1';
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error('User.findById error:', err);
                return callback(err);
            }
            if (!results || results.length === 0) return callback(null, null);
            return callback(null, results[0]);
        });
    }
};

module.exports = User;