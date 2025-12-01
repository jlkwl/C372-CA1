const Order = require('../models/Order');

const OrderController = {
    checkout: (req, res) => {
        const cart = req.session && Array.isArray(req.session.cart) ? req.session.cart : [];
        if (!cart || cart.length === 0) {
            req.flash('error', 'Your cart is empty.');
            return res.redirect('/cart');
        }

        const user = req.session && req.session.user;
        const userId = user && (user.id || user.userId);

        if (!userId) {
            req.flash('error', 'You must be logged in to checkout.');
            return res.redirect('/login');
        }

        // Create order from cart using model (transaction includes stock decrement)
        Order.createOrderFromCart(userId, cart, (err, createdOrder) => {
            if (err) {
                console.error('Order.createOrderFromCart error:', err);
                // If error contains "Insufficient stock" text, show that message; otherwise generic
                const msg = err.message || 'Failed to create order. Please try again.';
                req.flash('error', msg);
                return res.redirect('/cart');
            }

            // Success - clear cart and redirect to orders history
            req.session.cart = [];
            req.flash('success', 'Order placed successfully!');
            return res.redirect('/orders');
        });
    },

    listAll: (req, res) => {
        // Admin view of all orders; assume checkAdmin middleware applied in routes
        Order.getAllOrders((err, orders) => {
            if (err) {
                console.error('Order.getAllOrders error:', err);
                req.flash('error', 'Could not retrieve orders.');
                return res.redirect('/');
            }

            res.render('orders', {
                orders: orders || [],
                user: req.session.user,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    },

    listUserOrders: (req, res) => {
        const user = req.session && req.session.user;
        const userId = user && (user.id || user.userId);

        if (!userId) {
            req.flash('error', 'You must be logged in to view your orders.');
            return res.redirect('/login');
        }

        Order.getOrdersByUser(userId, (err, orders) => {
            if (err) {
                console.error('Order.getOrdersByUser error:', err);
                req.flash('error', 'Could not retrieve your orders.');
                return res.redirect('/');
            }

            res.render('orders', {
                orders: orders || [],
                user: req.session.user,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    },

    viewOrder: (req, res) => {
        const orderId = req.params.id;
        if (!orderId) {
            req.flash('error', 'No order specified.');
            return res.redirect('/orders');
        }

        Order.getOrderWithItems(orderId, (err, order) => {
            if (err) {
                console.error('Order.getOrderWithItems error:', err);
                req.flash('error', 'Could not retrieve order details.');
                return res.redirect('/orders');
            }

            if (!order) {
                req.flash('error', 'Order not found.');
                return res.redirect('/orders');
            }

            // order expected to include header and items
            res.render('orderDetails', {
                order,
                user: req.session.user,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        });
    }
};

module.exports = OrderController;