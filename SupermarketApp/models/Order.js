// models/Order.js
const db = require('../db');   // this is your existing db.js (single connection)

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

  // Get all orders for one user
  getOrdersByUser(userId, callback) {
    const sql =
      'SELECT * FROM orders WHERE userId = ? ORDER BY orderDate DESC';
    db.query(sql, [userId], callback);
  },

  // Get all items for one order
  getItemsByOrder(orderId, callback) {
    const sql = `
      SELECT oi.*, p.productName, p.image
      FROM order_items oi
      JOIN products p ON oi.productId = p.id
      WHERE oi.orderId = ?
    `;
    db.query(sql, [orderId], callback);
  }
};

module.exports = Order;
