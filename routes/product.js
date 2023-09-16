const router = require('express').Router();
const Product = require('../models/Product');
const isAuthed = require('../modules/auth-check');

router.get('/:product_name', async (req, res, next) => {
    const param = req.params.product_name.trim().replace(/\-|\$/g, "\\W+");
    const product = await Product.findOne({ name: RegExp(`^${param}$`, "i") });

    if (!product) return next();
    res.render("product-item", { product });
});

router.post('/create', isAuthed, async (req, res) => {
    const { name, info, colour, length_inches, size, price, unit_stock_qty, image_file, image_url } = req.body;
    const images = [image_file, image_url].flat().filter(e => e).map(url => ({ url }));
    const units = [{ colour, length_inches, size, price, unit_stock_qty, images }];
    try {
        await Product.create({ name, info, units });
        res.send("Product saved successfully!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/update', isAuthed, async (req, res) => {
    const { product_id, unit_id, name, info, colour, length_inches, size, price, unit_stock_qty, image_file, image_url } = req.body;
    const images = [image_file, image_url].flat().filter(e => e).map(url => ({ url }));
    try {
        const product = await Product.findById(product_id);
        const populated_fields = [colour, length_inches, size, price, unit_stock_qty].filter(e => e);
        const new_unit = unit_id == "new";

        if (name) product.name = name;
        if (info) product.info = info;

        if (new_unit && populated_fields.length) {
            product.units.shift({ colour, length_inches, size, price, unit_stock_qty, images });
        }
        else if (unit_id) {
            const unit = product.units.find(u => unit_id == u.id);
            if (unit) {
                if (colour) unit.colour = colour;
                if (length_inches) unit.length_inches = length_inches;
                if (size) unit.size = size;
                if (price) unit.price = price;
                if (unit_stock_qty) unit.unit_stock_qty = unit_stock_qty;
                unit.images = images;
            }
        }

        await product.save();
        res.send(`Product saved successfully${new_unit ? ", with the new unit" : ""}!`);
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/delete', isAuthed, async (req, res) => {
    if (!req.body.product_id && !req.body.unit_id) return res.status(400).send("Nothing selected");
    try {
        await Product.deleteByIds(req.body.product_id);
        await Product.deleteUnitsByIds(req.body.unit_id);
        res.send("Selected products now removed from stock");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/get-price', async (req, res) => {
    const { id, style } = req.body;
    if (!style) return res.status(400).send("");

    const product = await Product.findById(id).catch(e => null);
    const unit = product?.units.find(u => u.unit_description === style);
    if (!unit) return res.status(404).send("Sorry, your selected style option is not available right now.\nPlease check again later.");

    res.send({ price: unit.price, stock_qty: unit.unit_stock_qty });
});

module.exports = router;
