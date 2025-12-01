const db = require('../db');

const Order = {
    /**
     * Create an order from a user's cart.
     * - Validates stock (SELECT ... FOR UPDATE)
     * - Inserts orders row
     * - Inserts order_items rows
     * - Decrements product stock
     * All done inside a transaction. Calls callback(err, result).
     * result: { orderId, totalAmount }
     */
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

        const performTransaction = (conn) => {
            conn.beginTransaction(err => {
                if (err) {
                    console.error('Transaction begin error:', err);
                    if (conn.release) conn.release();
                    return callback(err);
                }

                // First, verify stock for each product (select for update)
                const checkStock = (idx) => {
                    if (idx >= cartItems.length) return insertOrder();
                    const item = cartItems[idx];
                    const pid = item.productId;

                    const sql = 'SELECT quantity, productName FROM products WHERE id = ? FOR UPDATE';
                    conn.query(sql, [pid], (err, rows) => {
                        if (err) {
                            console.error('Stock check query error:', err);
                            return conn.rollback(() => {
                                if (conn.release) conn.release();
                                return callback(err);
                            });
                        }
                        if (!rows || rows.length === 0) {
                            const e = new Error(`Product not found (id=${pid})`);
                            console.error(e);
                            return conn.rollback(() => {
                                if (conn.release) conn.release();
                                return callback(e);
                            });
                        }
                        const available = Number(rows[0].quantity) || 0;
                        const requested = Number(item.quantity) || 0;
                        if (requested > available) {
                            const e = new Error(`Insufficient stock for ${rows[0].productName}. Only ${available} available.`);
                            console.error(e);
                            return conn.rollback(() => {
                                if (conn.release) conn.release();
                                return callback(e);
                            });
                        }
                        // ok -> next
                        checkStock(idx + 1);
                    });
                };

                const insertOrder = () => {
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
                        const updateStockSql = 'UPDATE products SET quantity = quantity - ? WHERE id = ?';

                        const insertItemAndUpdateStock = (i) => {
                            if (i >= cartItems.length) {
                                // commit
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

                            const item = cartItems[i];
                            const pid = item.productId;
                            const qty = Number(item.quantity) || 0;
                            const price = Number(item.price) || 0;

                            conn.query(insertItemSql, [orderId, pid, qty, price], (itemErr) => {
                                if (itemErr) {
                                    console.error('Insert order_item error:', itemErr);
                                    return conn.rollback(() => {
                                        if (conn.release) conn.release();
                                        return callback(itemErr);
                                    });
                                }

                                conn.query(updateStockSql, [qty, pid], (updErr) => {
                                    if (updErr) {
                                        console.error('Update stock error:', updErr);
                                        return conn.rollback(() => {
                                            if (conn.release) conn.release();
                                            return callback(updErr);
                                        });
                                    }
                                    insertItemAndUpdateStock(i + 1);
                                });
                            });
                        };

                        insertItemAndUpdateStock(0);
                    });
                };

                // Start the stock checks
                checkStock(0);
            });
        };

        // Use pool connection if available to ensure consistent transaction behavior
        if (typeof db.getConnection === 'function') {
            db.getConnection((err, conn) => {
                if (err) {
                    console.error('db.getConnection error:', err);
                    return callback(err);
                }
                performTransaction(conn);
            });
        } else {
            // Fallback: use db directly (note: may not reliably hold same connection across queries on some pool implementations)
            // We'll still attempt to run a transaction using the shared connection.
            db.query('START TRANSACTION', (err) => {
                if (err) {
                    console.error('START TRANSACTION error:', err);
                    return callback(err);
                }

                // For fallback, implement same sequence but using db (shared connection)
                const checkStockFallback = (idx, done) => {
                    if (idx >= cartItems.length) return done(null);
                    const item = cartItems[idx];
                    const pid = item.productId;
                    const sql = 'SELECT quantity, productName FROM products WHERE id = ? FOR UPDATE';
                    db.query(sql, [pid], (err, rows) => {
                        if (err) return done(err);
                        if (!rows || rows.length === 0) return done(new Error(`Product not found (id=${pid})`));
                        const available = Number(rows[0].quantity) || 0;
                        const requested = Number(item.quantity) || 0;
                        if (requested > available) return done(new Error(`Insufficient stock for ${rows[0].productName}. Only ${available} available.`));
                        checkStockFallback(idx + 1, done);
                    });
                };

                const insertOrderFallback = () => {
                    const insertOrderSql = 'INSERT INTO orders (userId, totalAmount, status) VALUES (?, ?, ?)';
                    db.query(insertOrderSql, [userId, totalAmount, 'PLACED'], (err, orderResult) => {
                        if (err) {
                            console.error('Insert order error:', err);
                            return db.query('ROLLBACK', () => callback(err));
                        }

                        const orderId = orderResult.insertId;
                        const insertItemSql = 'INSERT INTO order_items (orderId, productId, quantity, priceAtTime) VALUES (?, ?, ?, ?)';
                        const updateStockSql = 'UPDATE products SET quantity = quantity - ? WHERE id = ?';

                        const insertNext = (i) => {
                            if (i >= cartItems.length) {
                                return db.query('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('COMMIT error:', commitErr);
                                        return db.query('ROLLBACK', () => callback(commitErr));
                                    }
                                    return callback(null, { orderId, totalAmount });
                                });
                            }
                            const item = cartItems[i];
                            const pid = item.productId;
                            const qty = Number(item.quantity) || 0;
                            const price = Number(item.price) || 0;

                            db.query(insertItemSql, [orderId, pid, qty, price], (itemErr) => {
                                if (itemErr) {
                                    console.error('Insert order_item error:', itemErr);
                                    return db.query('ROLLBACK', () => callback(itemErr));
                                }
                                db.query(updateStockSql, [qty, pid], (updErr) => {
                                    if (updErr) {
                                        console.error('Update stock error:', updErr);
                                        return db.query('ROLLBACK', () => callback(updErr));
                                    }
                                    insertNext(i + 1);
                                });
                            });
                        };

                        insertNext(0);
                    });
                };

                // Execute fallback flow
                checkStockFallback(0, (checkErr) => {
                    if (checkErr) {
                        console.error('Stock check error (fallback):', checkErr);
                        return db.query('ROLLBACK', () => callback(checkErr));
                    }
                    insertOrderFallback();
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