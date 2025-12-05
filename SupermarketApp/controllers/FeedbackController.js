const Feedback = require('../models/Feedback');

const FeedbackController = {
    submitFeedback(req, res) {
        const { subject, message } = req.body;
        const user = req.session.user;

        if (!subject || !message) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/help');
        }

        const data = {
            user_id: user.id,
            username: user.username,
            email: user.email,
            address: user.address,
            subject,
            message
        };

        Feedback.create(data, (err) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Failed to submit feedback.');
                return res.redirect('/help');
            }

            req.flash('success', 'Feedback submitted successfully!');
            res.redirect('/help');
        });
    },

    listFeedback(req, res) {
        Feedback.getAll((err, rows) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Could not load feedback.');
                return res.redirect('/inventory');
            }

            res.render('adminFeedback', {
                user: req.session.user,
                feedback: rows
            });
        });
    }
};

module.exports = FeedbackController;
