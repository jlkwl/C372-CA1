const User = require('../models/User');

const UserController = {
    showRegister: (req, res) => {
        res.render('register', {
            messages: req.flash('error'),
            formData: req.flash('formData')[0] || {}
        });
    },

    register: (req, res) => {
        const { username, email, password, confirmPassword, address, contact } = req.body;

        // Basic validation
        if (!username || !email || !password || !confirmPassword || !address || !contact) {
            req.flash('error', 'All fields are required.');
            req.flash('formData', { username, email, address, contact });
            return res.redirect('/register');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            req.flash('formData', { username, email, address, contact });
            return res.redirect('/register');
        }

        // Force role to 'user' regardless of form input
        const role = 'user';

        // Create user via model (callback style)
        User.create({ username, email, password, address, contact, role }, (err, result) => {
            if (err) {
                req.flash('error', 'Registration failed. ' + (err.message || ''));
                req.flash('formData', { username, email, address, contact });
                return res.redirect('/register');
            }

            req.flash('success', 'Registration successful! Please log in.');
            return res.redirect('/login');
        });
    },

    showLogin: (req, res) => {
        res.render('login', {
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    },

    login: (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/login');
        }

        // Verify credentials using model method
        User.findByEmailAndPassword(email, password, (err, user) => {
            if (err) {
                req.flash('error', 'Login failed. ' + (err.message || ''));
                return res.redirect('/login');
            }

            if (!user) {
                req.flash('error', 'Invalid email or password.');
                return res.redirect('/login');
            }

            // Successful login: store session info
            req.session.user = user;
            req.session.isAuthenticated = true;
            req.session.isAdmin = (user.role === 'admin');

            if (req.session.isAdmin) {
                return res.redirect('/inventory');
            } else {
                return res.redirect('/shopping');
            }
        });
    },

    logout: (req, res) => {
        req.session.destroy(err => {
            if (err) {
                req.flash('error', 'Logout failed.');
                return res.redirect('/');
            }
            req.flash('success', 'You have been logged out.');
            res.redirect('/login');
        });
    }
};

module.exports = UserController;