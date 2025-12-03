const db = require('../db');

const Product = {

    // Search + Category filter
    getFilteredProducts: (search, category, callback) => {

        let sql = "SELECT * FROM products WHERE 1";
        const params = [];

        if (search) {
            sql += " AND (productName LIKE ? OR category LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category && category !== 'All') {
            sql += " AND category = ?";
            params.push(category);
        }

        db.query(sql, params, (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results);
        });
    },

    // Admin use: Get all products
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
        const { productName, quantity, price, image, category } = productData;

        db.query(
            'INSERT INTO products (productName, quantity, price, image, category) VALUES (?, ?, ?, ?, ?)',
            [productName, quantity, price, image, category],
            (err, result) => {
                if (err) return callback(err, null);
                return callback(null, result);
            }
        );
    },

    // Update product
    updateProduct: (id, productData, callback) => {
        const { productName, quantity, price, image, category } = productData;

        db.query(
            'UPDATE products SET productName=?, quantity=?, price=?, image=?, category=? WHERE id=?',
            [productName, quantity, price, image, category, id],
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
