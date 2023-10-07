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
        if (!err.errors) return res.status(400).send(err.message);
        const errors = Object.values(err.errors);
        const messages = errors.map(e => e.message.replace(/^path/i, "").replace(/\`/g, '"').trim());
        res.status(400).send(messages.join("\n"));
    }
});

router.post('/update', isAuthed, async (req, res) => {
    const { product_id, unit_id, name, info, colour, length_inches, size, price, unit_stock_qty, image_file, image_url, remove_all_images } = req.body;
    try {
        const product = await Product.findById(product_id);
        if (!product) return res.status(404).send("Product not found");
        if (name) product.name = name;
        if (info) product.info = info;

        const images = [image_file, image_url].flat().filter(e => e).map(url => ({ url }));
        const new_unit = unit_id == "new";

        if (new_unit) {
            product.units.unshift({ colour, length_inches, size, price, unit_stock_qty, images });
        }
        else if (unit_id) {
            const unit = product.units.find(u => unit_id == u.id);
            if (!unit) return res.status(404).send("Product unit not found");

            if (colour) unit.colour = colour;
            if (length_inches) unit.length_inches = length_inches;
            if (size) unit.size = size;
            if (price) unit.price = price;
            if (unit_stock_qty) unit.unit_stock_qty = unit_stock_qty;
            if (images.length || remove_all_images == "true") unit.images = images;
        }

        await product.save();
        res.send(`Product saved successfully${new_unit ? ", with the new unit" : ""}!`);
    } catch (err) {
        if (!err.errors) return res.status(400).send(err.message);
        const errors = Object.values(err.errors);
        const messages = errors.map(e => e.message.replace(/^path/i, "").replace(/\`/g, '"').trim());
        res.status(400).send(messages.join("\n"));
    }
});

router.post('/delete', isAuthed, async (req, res) => {
    if (!req.body.product_id && !req.body.unit_id) return res.status(400).send("Nothing selected");
    const ids = [req.body.product_id].flat().filter(e => e);
    const unit_ids = [req.body.unit_id].flat().filter(e => e);

    try {
        if (ids.length) await Product.deleteMany({ _id : { $in: ids } });

        const products = unit_ids.length ? await Product.find({ "units._id": { $in: unit_ids } }) : [];
        await Promise.all(products.map(product => {
            product.units = product.units.filter(u => !unit_ids.includes(u.id));
            return !product.units.length ? product.delete() : product.save();
        }));

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

    const { price, unit_stock_qty: stock_qty } = unit;
    var stock_status = "";
    if (stock_qty < 5) stock_status = `Only ${stock_qty} left`;
    if (stock_qty == 0) stock_status = "Out of stock";
    res.send({ price, stock_qty, stock_status });
});

module.exports = router;
