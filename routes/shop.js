const router = require('express').Router();
const Product = require('../models/Product');

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

    const index = req.session.cart.findIndex(item => item.unit._id == unit.id);
    if (index != -1) {
        const item = req.session.cart[index];
        const new_quantity = item.quantity + quantity;
        item.unit.quantity = unit.unit_stock_qty;
        item.quantity = Math.min(new_quantity, unit.unit_stock_qty);
    } else {
        req.session.cart.push({
            product_id: id,
            name: product.name,
            unit: unit.toObject({ virtuals: true }),
            quantity: Math.min(quantity, unit.unit_stock_qty),
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

router.post('/cart/change-quantity', async (req, res) => {
    const { id, quantity } = req.body;
    const item = req.session.cart.find(item => item.unit._id == id);
    if (!item) return res.status(404).send("Item not found in cart");

    const qty = item.quantity = Math.min(parseInt(quantity), item.unit.unit_stock_qty);

    const count = req.session.cart.length;
    const price_total = req.session.price_total();
    res.render("components/cart", (err, cartHtml) => res.send({ count, price_total, qty, cartHtml }));
});

module.exports = router;
