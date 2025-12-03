// controllers/OrderController.js

const connection = require('../db');

// -------------------------------------------
// CHECKOUT — Create order, save items, update stock
// -------------------------------------------
exports.checkout = (req, res) => {
    const cart = req.session.cart || [];
    const user = req.session.user;

    if (!cart || cart.length === 0) {
        req.flash('error', 'Your cart is empty.');
        return res.redirect('/cart');
    }

    // Calculate total
    const totalAmount = cart.reduce((sum, item) => {
        return sum + item.price * item.quantity;
    }, 0);

    // 1️⃣ Insert into orders table
    const orderSql = `INSERT INTO orders (userId, totalAmount) VALUES (?, ?)`;
    connection.query(orderSql, [user.id, totalAmount], (err, orderResult) => {
        if (err) throw err;

        const orderId = orderResult.insertId;

        // 2️⃣ Insert items into order_items (one by one)
        const itemSql =
            `INSERT INTO order_items (orderId, productId, quantity, priceAtTime)
             VALUES (?, ?, ?, ?)`;

        cart.forEach(item => {
            connection.query(
                itemSql,
                [orderId, item.productId, item.quantity, item.price],
                err => {
                    if (err) throw err;
                }
            );

            // 3️⃣ Deduct inventory from products
            const updateStockSql =
                `UPDATE products SET quantity = quantity - ? WHERE id = ?`;

            connection.query(updateStockSql, [item.quantity, item.productId]);
        });

        // 4️⃣ Clear cart
        req.session.cart = [];

        // Redirect to invoice page
        req.flash('success', 'Order placed successfully!');
        res.redirect(`/order/${orderId}`);
    });
};

// -------------------------------------------
// LIST USER ORDERS (order history)
// -------------------------------------------
exports.listUserOrders = (req, res) => {
    const userId = req.session.user.id;

    const sql = `
        SELECT * FROM orders
        WHERE userId = ?
        ORDER BY orderDate DESC
    `;

    connection.query(sql, [userId], (err, orders) => {
        if (err) throw err;

        res.render('orders', {
            orders,
            user: req.session.user,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
};

// -------------------------------------------
// VIEW ORDER DETAILS + ITEMS (invoice)
// -------------------------------------------
exports.viewOrder = (req, res) => {
    const orderId = req.params.id;

    // 1️⃣ Get order info
    const orderSql = `SELECT * FROM orders WHERE id = ?`;

    connection.query(orderSql, [orderId], (err, orderResults) => {
        if (err) throw err;

        if (orderResults.length === 0) {
            req.flash('error', 'Order not found.');
            return res.redirect('/orders');
        }

        const order = orderResults[0];

        // 2️⃣ Get items for this order
        const itemsSql = `
            SELECT oi.*, p.productName, p.image
            FROM order_items oi
            JOIN products p ON oi.productId = p.id
            WHERE oi.orderId = ?
        `;

        connection.query(itemsSql, [orderId], (err, items) => {
            if (err) throw err;

            res.render('orderDetails', {
                order,
                items,
                user: req.session.user,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    });
};
