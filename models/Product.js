const { map } = require('async');
const { default: axios } = require('axios');
const { model, Schema, Document: Doc } = require('mongoose');
const cloud = require('cloudinary').v2;
const production = process.env.NODE_ENV === "production";
const test_path = !production ? "test/" : "";
Schema.Types.String.set('trim', true);
Schema.Types.Number.set('default', 0);

const Product = module.exports = model('Product', (() => {
    const u_schema = new Schema({
        colour: { type: String, required: true },
        length_inches: { type: Number, required: true },
        size: { type: String, required: true },
        price: { type: Number, required: true },
        unit_stock_qty: { type: Number, required: true, min: [0, "No negative values allowed for stock quantity"] },
        images: [{ p_id: String, url: String }],
        main_image_index: { type: Number, min: 0 }
    });

    u_schema.virtual("unit_description").get(function() {
        const colour = this.colour.toLowerCase().replace(/\b./g, m => m.toUpperCase());
        return `${this.length_inches}in ${colour} (${this.size})`;
    });

    u_schema.virtual("main_image").get(function() {
        return this.images[this.main_image_index];
    });

    u_schema.pre("save", async function(next) {
        const unit = this;
        const p_ids = [];
        const images_updated = unit.modifiedPaths({ includeChildren: true }).includes("images");
        const existing = unit.$parent().units.find(u => u.id != unit.id && u.unit_description === unit.unit_description);
        if (existing) return next(Error("Cannot save product in the same style as another (duplicate)"));
        if (!images_updated) return next();

        try {
            const isDataURL = s => !!s.match(isDataURL.regex);
            isDataURL.regex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

            const promises = unit.images.filter(img => !isDataURL(img.url)).map(img => axios.get(img.url));
            await Promise.all(promises).catch(e => { throw Error("One or more selected image sources not found / valid") });

            unit.images = await map(unit.images, (image, cb) => {
                const public_id = `simbaluxe/${test_path}products/${unit.$parent().name}_${unit.unit_description}_${Date.now()}`.replace(/[ ?&#\\%<>+]/g, "_");
                cloud.uploader.upload(image.url, { public_id }, (err, result) => {
                    if (err) return cb(err);
                    p_ids.push(result.public_id);
                    cb(null, { p_id: result.public_id, url: result.secure_url });
                });
            });

            unit.main_image_index = Math.min(unit.main_image_index, unit.images.length-1);
            unit.main_image_index = Math.max(unit.main_image_index, 0);
            next();
        } catch (err) {
            await cloud.api.delete_resources(p_ids).catch(e => e);
            next(err)
        }
    });

    const p_schema = new Schema({
        name: { type: String, required: true, index: true },
        units: [u_schema],
        info: { type: String, default: "" }
    });

    p_schema.virtual("stock_qty").get(function() {
        return this.units.reduce((sum, unit) => sum + unit.unit_stock_qty, 0);
    });

    p_schema.virtual("link").get(function() {
        const replace_matches = m => ["$"].includes(m) ? m : "-";
        const name = this.name.replace(/\W/g, replace_matches).replace(/\-+/g, "-").replace(/^\-|\-$/, '');
        return `/shop/product/${name}`.toLowerCase();
    });

    p_schema.virtual("main_images").get(function() {
        return this.units.map(unit => unit.main_image).filter(img => img?.url);
    });

    p_schema.virtual("all_images").get(function() {
        return this.units.map(unit => unit.images).flat().filter(img => img?.url);
    });

    p_schema.pre(/save|update/i, async function() {
        const docs = this instanceof Doc ? [this] : await Product.find(this.getFilter());
        const products = await Product.find();
        for (const doc of docs) {
            const found = products.find(p => p.id != doc.id && p.link === doc.link);
            if (found) throw Error("Cannot save product with the same name as another");
        }
    });

    p_schema.post(/save|update|delete|remove/i, async function() {
        const prefix = `simbaluxe/${test_path}products`;
        const { resources } = await cloud.api.resources({ prefix, type: "upload", max_results: 500 });

        const products = await Product.find();
        const all_images = products.map(p => p.all_images).flat();
        const p_ids = all_images.map(img => img.p_id);
        const unsaved_p_ids = resources.map(r => r.public_id).filter(p_id => !p_ids.includes(p_id));
        await cloud.api.delete_resources(unsaved_p_ids).catch(e => e);
    });

    return p_schema;
})());
