const db = require('../db');

const CartDB = {
  // Get full cart (joined with product)
  getCart(userId, callback) {
    const sql = `
      SELECT 
        c.productId,
        c.quantity,
        p.productName,
        p.price,
        p.image
      FROM user_cart c
      JOIN products p ON c.productId = p.id
      WHERE c.userId = ?
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows || []);
    });
  },

  // Get a single item for a user
  getItem(userId, productId, callback) {
    const sql = `SELECT * FROM user_cart WHERE userId = ? AND productId = ?`;
    db.query(sql, [userId, productId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    });
  },

  // Set exact quantity (insert or update)
  setItemQuantity(userId, productId, quantity, callback) {
    const sql = `
      INSERT INTO user_cart (userId, productId, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
    `;
    db.query(sql, [userId, productId, quantity], callback);
  },

  // Remove one product from cart
  removeItem(userId, productId, callback) {
    const sql = `DELETE FROM user_cart WHERE userId = ? AND productId = ?`;
    db.query(sql, [userId, productId], callback);
  },

  // Clear entire cart
  clearCart(userId, callback) {
    const sql = `DELETE FROM user_cart WHERE userId = ?`;
    db.query(sql, [userId], callback);
  }
};

module.exports = CartDB;