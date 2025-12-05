const db = require('../db');

const FeedbackController = {
    
    // USER submits feedback
    submitFeedback: (req, res) => {
        const { subject, message } = req.body;
        const userId = req.session.user.id;

        if (!subject || !message) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/help');
        }

        const sql = `
            INSERT INTO feedback (user_id, subject, message)
            VALUES (?, ?, ?)
        `;

        db.query(sql, [userId, subject, message], (err) => {
            if (err) throw err;

            req.flash('success', 'Feedback submitted successfully!');
            res.redirect('/help');
        });
    },

    // ADMIN views feedback list
    listFeedback: (req, res) => {
        const sql = `
            SELECT f.*, u.username, u.email, u.address
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.created_at DESC
        `;

        db.query(sql, (err, rows) => {
            if (err) throw err;

            res.render('adminFeedback', {
                user: req.session.user,
                feedback: rows
            });
        });
    },

    // ADMIN deletes feedback
    deleteFeedback: (req, res) => {
        const id = req.params.id;

        db.query(`DELETE FROM feedback WHERE id = ?`, [id], (err) => {
            if (err) throw err;
            res.redirect('/admin/feedback');
        });
    },

    // ADMIN replies to feedback
    replyFeedback: (req, res) => {
        const { reply } = req.body;
        const id = req.params.id;

        db.query(
            `UPDATE feedback SET admin_reply = ? WHERE id = ?`,
            [reply, id],
            (err) => {
                if (err) throw err;
                res.redirect('/admin/feedback');
            }
        );
    }
};

module.exports = FeedbackController;
