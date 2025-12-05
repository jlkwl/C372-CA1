// models/Order.js
const db = require('../db');

const Order = {
  // Create an order from the current cart
  createOrderFromCart(userId, cart, callback) {
    if (!cart || cart.length === 0) {
      return callback(null, null);   // nothing to save
    }

    // 1) calculate total amount
    let totalAmount = 0;
    cart.forEach(item => {
      totalAmount += Number(item.price) * Number(item.quantity);
    });

    // 2) insert into orders table
    const insertOrderSql =
      'INSERT INTO orders (userId, totalAmount, status) VALUES (?, ?, ?)';
    db.query(insertOrderSql, [userId, totalAmount, 'PLACED'], (err, orderResult) => {
      if (err) return callback(err);

      const orderId = orderResult.insertId;

      // 3) insert all order items
      const itemsValues = cart.map(item => [
        orderId,
        item.productId,
        item.quantity,
        item.price   // priceAtTime
      ]);

      const insertItemsSql =
        'INSERT INTO order_items (orderId, productId, quantity, priceAtTime) VALUES ?';

      db.query(insertItemsSql, [itemsValues], (err2) => {
        if (err2) return callback(err2);

        // 4) update inventory for each product
        const updateSql =
          'UPDATE products SET quantity = quantity - ? WHERE id = ?';

        let remaining = cart.length;
        cart.forEach(item => {
          db.query(updateSql, [item.quantity, item.productId], (err3) => {
            if (err3) return callback(err3);

            remaining -= 1;
            if (remaining === 0) {
              // all updates done
              callback(null, { orderId, totalAmount });
            }
          });
        });
      });
    });
  },

  // My Orders — all orders for one user
  getOrdersByUser(userId, callback) {
    const sql = `
      SELECT 
        o.id        AS orderId,
        o.orderDate AS orderDate,
        o.totalAmount,
        o.status,
        u.username  AS userName
      FROM orders o
      JOIN users u ON o.userId = u.id
      WHERE o.userId = ?
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, [userId], callback);
  },

  // Admin view — all orders
  getAllOrders(callback) {
    const sql = `
      SELECT 
        o.id        AS orderId,
        o.orderDate AS orderDate,
        o.totalAmount,
        o.status,
        u.username  AS userName
      FROM orders o
      JOIN users u ON o.userId = u.id
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, [], callback);
  },

  // Items for one order (helper if needed)
  getItemsByOrder(orderId, callback) {
    const sql = `
      SELECT 
        oi.*, 
        p.productName, 
        p.image
      FROM order_items oi
      JOIN products p ON oi.productId = p.id
      WHERE oi.orderId = ?
    `;
    db.query(sql, [orderId], callback);
  },

  // Header + items together — used by invoice page
  getOrderWithItems(orderId, callback) {
    const orderSql = `
      SELECT 
        o.id        AS orderId,
        o.orderDate,
        o.totalAmount,
        o.status,
        u.username  AS userName,
        u.email,
        u.address,
        u.contact
      FROM orders o
      JOIN users u ON o.userId = u.id
      WHERE o.id = ?
      LIMIT 1
    `;

    db.query(orderSql, [orderId], (err, orderRows) => {
      if (err) return callback(err);
      if (!orderRows || !orderRows.length) return callback(null, null);

      const order = orderRows[0];

      const itemsSql = `
        SELECT 
          oi.quantity,
          oi.priceAtTime,
          p.productName,
          p.image
        FROM order_items oi
        JOIN products p ON oi.productId = p.id
        WHERE oi.orderId = ?
      `;
      db.query(itemsSql, [orderId], (err2, itemRows) => {
        if (err2) return callback(err2);

        callback(null, {
          header: order,
          items: itemRows || []
        });
      });
    });
  }
};

module.exports = Order;