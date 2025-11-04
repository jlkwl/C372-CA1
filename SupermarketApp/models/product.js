const db = require('../db');

const Product = {
    // Get all products
    getAllProducts: (callback) => {
        db.query('SELECT * FROM products', (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results);
        });
    },

    // Get product by ID
    getProductById: (id, callback) => {
        db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results[0]);
        });
    },

    // Add new product
    addProduct: (productData, callback) => {
        const { productName, quantity, price, image } = productData;
        db.query(
            'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)',
            [productName, quantity, price, image],
            (err, result) => {
                if (err) return callback(err, null);
                return callback(null, result);
            }
        );
    },

    // Update product
    updateProduct: (id, productData, callback) => {
        const { productName, quantity, price, image } = productData;
        db.query(
            'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?',
            [productName, quantity, price, image, id],
            (err, result) => {
                if (err) return callback(err, null);
                return callback(null, result);
            }
        );
    },

    // Delete product
    deleteProduct: (id, callback) => {
        db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
            if (err) return callback(err, null);
            return callback(null, result);
        });
    }
};

module.exports = Product;
