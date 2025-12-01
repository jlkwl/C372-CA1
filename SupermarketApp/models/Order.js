const db = require('../db');

const Order = {
    createOrderFromCart: (userId, cartItems, callback) => {
        if (!userId) {
            const err = new Error('Missing userId');
            console.error(err);
            return callback(err);
        }
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            const err = new Error('Cart is empty');
            console.error(err);
            return callback(err);
        }

        const totalAmount = cartItems.reduce((sum, it) => {
            const price = Number(it.price) || 0;
            const qty = Number(it.quantity) || 0;
            return sum + price * qty;
        }, 0);

        const doInsertWithConnection = (conn) => {
            conn.beginTransaction(err => {
                if (err) {
                    console.error('Transaction begin error:', err);
                    if (conn.release) conn.release();
                    return callback(err);
                }

                const insertOrderSql = 'INSERT INTO orders (userId, totalAmount, status) VALUES (?, ?, ?)';
                conn.query(insertOrderSql, [userId, totalAmount, 'PLACED'], (err, orderResult) => {
                    if (err) {
                        console.error('Insert order error:', err);
                        return conn.rollback(() => {
                            if (conn.release) conn.release();
                            return callback(err);
                        });
                    }

                    const orderId = orderResult.insertId;
                    const insertItemSql = 'INSERT INTO order_items (orderId, productId, quantity, priceAtTime) VALUES (?, ?, ?, ?)';

                    const insertNext = (idx) => {
                        if (idx >= cartItems.length) {
                            return conn.commit(commitErr => {
                                if (commitErr) {
                                    console.error('Commit error:', commitErr);
                                    return conn.rollback(() => {
                                        if (conn.release) conn.release();
                                        return callback(commitErr);
                                    });
                                }
                                if (conn.release) conn.release();
                                return callback(null, { orderId, totalAmount });
                            });
                        }

                        const item = cartItems[idx];
                        const productId = item.productId;
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;

                        conn.query(insertItemSql, [orderId, productId, qty, price], (itemErr) => {
                            if (itemErr) {
                                console.error('Insert order_item error:', itemErr);
                                return conn.rollback(() => {
                                    if (conn.release) conn.release();
                                    return callback(itemErr);
                                });
                            }
                            insertNext(idx + 1);
                        });
                    };

                    insertNext(0);
                });
            });
        };

        // Prefer getting a dedicated connection (pool) if available
        if (typeof db.getConnection === 'function') {
            db.getConnection((err, conn) => {
                if (err) {
                    console.error('getConnection error:', err);
                    return callback(err);
                }
                doInsertWithConnection(conn);
            });
        } else {
            // Fallback: use db directly (serial queries with transaction statements)
            db.query('START TRANSACTION', (err) => {
                if (err) {
                    console.error('START TRANSACTION error:', err);
                    return callback(err);
                }

                const insertOrderSql = 'INSERT INTO orders (userId, totalAmount, status) VALUES (?, ?, ?)';
                db.query(insertOrderSql, [userId, totalAmount, 'PLACED'], (err, orderResult) => {
                    if (err) {
                        console.error('Insert order error:', err);
                        return db.query('ROLLBACK', () => callback(err));
                    }

                    const orderId = orderResult.insertId;
                    const insertItemSql = 'INSERT INTO order_items (orderId, productId, quantity, priceAtTime) VALUES (?, ?, ?, ?)';

                    const insertNext = (idx) => {
                        if (idx >= cartItems.length) {
                            return db.query('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error('COMMIT error:', commitErr);
                                    return db.query('ROLLBACK', () => callback(commitErr));
                                }
                                return callback(null, { orderId, totalAmount });
                            });
                        }

                        const item = cartItems[idx];
                        const productId = item.productId;
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;

                        db.query(insertItemSql, [orderId, productId, qty, price], (itemErr) => {
                            if (itemErr) {
                                console.error('Insert order_item error:', itemErr);
                                return db.query('ROLLBACK', () => callback(itemErr));
                            }
                            insertNext(idx + 1);
                        });
                    };

                    insertNext(0);
                });
            });
        }
    },

    getAllOrders: (callback) => {
        const sql = `
            SELECT o.*, u.name AS userName
            FROM orders o
            LEFT JOIN users u ON o.userId = u.userId
            ORDER BY o.orderDate DESC
        `;
        db.query(sql, [], (err, results) => {
            if (err) {
                console.error('Order.getAllOrders error:', err);
                return callback(err);
            }
            return callback(null, results || []);
        });
    },

    getOrdersByUser: (userId, callback) => {
        const sql = `
            SELECT o.*, u.name AS userName
            FROM orders o
            LEFT JOIN users u ON o.userId = u.userId
            WHERE o.userId = ?
            ORDER BY o.orderDate DESC
        `;
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error('Order.getOrdersByUser error:', err);
                return callback(err);
            }
            return callback(null, results || []);
        });
    },

    getOrderWithItems: (orderId, callback) => {
        const sqlOrder = 'SELECT o.*, u.name AS userName FROM orders o LEFT JOIN users u ON o.userId = u.userId WHERE o.orderId = ? LIMIT 1';
        db.query(sqlOrder, [orderId], (err, orders) => {
            if (err) {
                console.error('Order.getOrderWithItems (order) error:', err);
                return callback(err);
            }
            if (!orders || orders.length === 0) return callback(null, null);

            const order = orders[0];

            const sqlItems = `
                SELECT oi.*, p.productName, p.image
                FROM order_items oi
                LEFT JOIN products p ON oi.productId = p.id
                WHERE oi.orderId = ?
            `;
            db.query(sqlItems, [orderId], (err2, items) => {
                if (err2) {
                    console.error('Order.getOrderWithItems (items) error:', err2);
                    return callback(err2);
                }

                order.items = items || [];
                return callback(null, order);
            });
        });
    }
};

module.exports = Order;