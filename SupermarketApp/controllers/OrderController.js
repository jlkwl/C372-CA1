// controllers/OrderController.js
const Order = require('../models/Order');

const OrderController = {
    // Create an order from the cart, update inventory, then go to invoice view
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
                const msg = err.message || 'Failed to create order. Please try again.';
                req.flash('error', msg);
                return res.redirect('/cart');
            }

            // ✅ Success - clear cart and go straight to invoice / order details
            req.session.cart = [];
            req.flash('success', 'Order placed successfully!');
            return res.redirect(`/order/${createdOrder.orderId}`);
        });
    },

    // Admin view of all orders (if you use it)
    listAll: (req, res) => {
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

    // Current user's orders (My Orders page)
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

    // Single order view (invoice style)
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

            // order = { header: {...}, items: [...] }
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
