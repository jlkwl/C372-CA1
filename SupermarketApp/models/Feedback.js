const db = require('../db');

const Feedback = {
    getAll(callback) {
        const sql = `SELECT * FROM feedback ORDER BY created_at DESC`;
        db.query(sql, callback);
    },

    getById(id, callback) {
        const sql = `SELECT * FROM feedback WHERE id = ?`;
        db.query(sql, [id], callback);
    },

    create(user_id, username, email, address, subject, message, callback) {
        const sql = `
            INSERT INTO feedback (user_id, username, email, address, subject, message)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.query(sql, [user_id, username, email, address, subject, message], callback);
    },

    delete(id, callback) {
        const sql = `DELETE FROM feedback WHERE id = ?`;
        db.query(sql, [id], callback);
    },

    reply(id, reply, callback) {
        const sql = `
            UPDATE feedback 
            SET admin_reply = ?, reply_date = NOW()
            WHERE id = ?
        `;
        db.query(sql, [reply, id], callback);
    }
};

module.exports = Feedback;
