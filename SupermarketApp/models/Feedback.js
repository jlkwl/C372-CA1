const db = require('../db');

const Feedback = {
    create: (data, callback) => {
        const sql = `
            INSERT INTO feedback (user_id, subject, message)
            VALUES (?, ?, ?)
        `;
        db.query(sql, [data.user_id, data.subject, data.message], callback);
    },

    getAll: (callback) => {
        const sql = `
            SELECT f.*, u.username, u.email
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.created_at DESC
        `;
        db.query(sql, callback);
    },

    delete: (id, callback) => {
        const sql = `DELETE FROM feedback WHERE id = ?`;
        db.query(sql, [id], callback);
    },

    reply: (id, reply, callback) => {
        const sql = `
            UPDATE feedback 
            SET admin_reply = ? 
            WHERE id = ?
        `;
        db.query(sql, [reply, id], callback);
    }
};

module.exports = Feedback;
