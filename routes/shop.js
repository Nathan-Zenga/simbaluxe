const router = require('express').Router();
const Product = require('../models/Product');
const { max_quantity_option } = require('../config/constants');

router.post('/cart/add', async (req, res) => {
    const { id, style, quantity: qty } = req.body;
    const opts = { ...req.body }; delete opts.id;
    const missing = Object.keys(opts).filter(k => !opts[k]);
    if (!style) return res.status(400).send("Please select the following options: " + missing.join(", "));

    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity < 1) return res.status(400).send("Missing or invalid quantity selected");

    const product = await Product.findById(id).catch(e => null);
    const unit = product?.units.find(u => u.unit_description === style);
    if (!unit) return res.status(404).send("Product not found");
    if (!unit.unit_stock_qty) return res.status(404).send("Product out of stock");
    if (quantity > max_quantity_option) return res.status(400).send(`You can only select up to ${max_quantity_option} at a time.`);
    if (quantity > unit.unit_stock_qty) return res.status(400).send(`Only ${unit.unit_stock_qty} item(s) left in stock.\nPlease adjust the quantity.`);

    const selected_item = req.session.cart.find(item => item.unit._id == unit.id);
    const max_quantity = Math.min(max_quantity_option, unit.unit_stock_qty);

    if (selected_item) {
        const new_quantity = selected_item.quantity + quantity;
        selected_item.quantity = Math.min(new_quantity, max_quantity);
        selected_item.unit.unit_stock_qty = unit.unit_stock_qty;
    } else {
        req.session.cart.push({
            product_id: id,
            name: product.name,
            unit: unit.toObject({ virtuals: true }),
            quantity: Math.min(quantity, max_quantity),
            link: product.link
        });
    }

    res.render("components/cart", (err, cartHtml) => res.send({ count: req.session.cart.length, cartHtml }));
});

router.post('/cart/remove', (req, res) => {
    res.locals.cart = req.session.cart = req.session.cart.filter(item => item.unit._id != req.body.id);
    const count = req.session.cart.length;
    const price_total = req.session.price_total();
    res.render("components/cart", (err, cartHtml) => res.send({ count, price_total, cartHtml }));
});

router.post('/cart/change-quantity', (req, res) => {
    const { id, quantity: q } = req.body;
    const quantity = parseInt(q);
    if (isNaN(quantity) || quantity < 1) return res.status(400).send("Missing or invalid quantity selected");

    const item = req.session.cart.find(item => item.unit._id == id);
    if (!item) return res.status(404).send("Item not found in cart");
    if (quantity > max_quantity_option) return res.status(400).send(`You can only select up to ${max_quantity_option} at a time.`);

    const message = `Only ${item.unit.unit_stock_qty} item(s) left in stock.\nPlease adjust the quantity.`;
    if (quantity > item.unit.unit_stock_qty) return res.status(400).send({ message, qty: item.unit.unit_stock_qty });

    const qty = item.quantity = Math.min(quantity, item.unit.unit_stock_qty);

    const count = req.session.cart.length;
    const price_total = req.session.price_total();
    res.render("components/cart", (err, cartHtml) => res.send({ count, price_total, qty, cartHtml }));
});

module.exports = router;
