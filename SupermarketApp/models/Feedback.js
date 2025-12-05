const db = require('../db');

const Feedback = {
    create(data, callback) {
        const sql = `
            INSERT INTO feedback (user_id, username, email, address, subject, message)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.query(sql, [
            data.user_id,
            data.username,
            data.email,
            data.address,
            data.subject,
            data.message
        ], callback);
    },

    getAll(callback) {
        const sql = `SELECT * FROM feedback ORDER BY created_at DESC`;
        db.query(sql, callback);
    }
};

module.exports = Feedback;
