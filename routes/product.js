const router = require('express').Router();
const Product = require('../models/Product');

router.get('/:product_name', async (req, res, next) => {
    const param = req.params.product_name.trim().replace(/\-|\$/g, "\\W+");
    const product = await Product.findOne({ name: RegExp(`^${param}$`, "i") });

    if (!product) return next();
    res.render("product-item", { product });
});

router.post('/create', async (req, res) => {
    const { name, info, colour, length_inches, size, price, unit_stock_qty, image_file, image_url } = req.body;
    const images = [image_file, image_url].flat().filter(e => e);
    const units = [{ colour, length_inches, size, price, unit_stock_qty, images }];
    try {
        await Product.create({ name, info, units });
        res.send("Product saved successfully!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/unit/create', async (req, res) => {
    const { product_id, colour, length_inches, size, price, unit_stock_qty, image_file, image_url } = req.body;
    const images = [image_file, image_url].flat().filter(e => e);
    try {
        const product = await Product.findById(product_id);
        product.units.shift({ colour, length_inches, size, price, unit_stock_qty, images });
        await product.save();
        res.send("Product unit saved successfully!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/delete', async (req, res) => {
    try {
        await Product.deleteByIds(req.body.product_id);
        res.send("Product now removed from stock");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/unit/delete', async (req, res) => {
    try {
        await Product.deleteUnitsByIds(req.body.unit_id);
        res.send("Product unit now removed from stock");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/get-price', async (req, res) => {
    const { id, style } = req.body;
    if (!style) return res.status(400).send("");

    const product = await Product.findById(id).catch(e => null);
    const unit = product?.units.find(u => u.unit_description === style);
    if (!unit) return res.status(404).send("Sorry, your preferred style is not available right now.\nPlease check again later.");

    res.send({ price: unit.price, stock_qty: unit.unit_stock_qty });
});

module.exports = router;
