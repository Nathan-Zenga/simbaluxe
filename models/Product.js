const { map, each } = require('async');
const { model, Schema } = require('mongoose');
const cloud = require('cloudinary').v2;
Schema.Types.String.set('trim', true);
Schema.Types.Number.set('default', 0);
const production = process.env.NODE_ENV === "production";

const Product = module.exports = model('Product', (() => {
    const u_schema = new Schema({
        colour: { type: String, required: true },
        length_inches: { type: Number, required: true },
        size: { type: String, required: true },
        price: { type: Number, required: true },
        unit_stock_qty: { type: Number, min: [0, "No negative values allowed for stock quantity"] },
        images: [{ p_id: String, url: String }],
        main_image_index: { type: Number, min: 0 }
    });

    u_schema.virtual("unit_description").get(function() {
        return `${this.length_inches}in ${this.colour} (${this.size})`;
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

        try {
            const results = !images_updated ? unit.images : await map(unit.images, (image, cb) => {
                const test_path = !production ? "test/" : "";
                const public_id = `simbaluxe/${test_path}products/${unit.$parent().name}_${unit.unit_description}_${Date.now()}`.replace(/[ ?&#\\%<>]/g, "_");
                cloud.uploader.upload(image.url, { public_id }, (err, result) => {
                    if (err) return cb(err);
                    p_ids.push(result.public_id);
                    cb(null, { p_id: result.public_id, url: result.secure_url });
                });
            });

            unit.images = results;
            unit.main_image_index = Math.min(unit.main_image_index, results.length-1);
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
        const name = this.name.replace(/\W/g, replace_matches).replace(/\-+/g, "-").replace(/^\W+|\W+$/, '');
        return `/shop/product/${name}`.toLowerCase();
    });

    p_schema.virtual("main_images").get(function() {
        return this.units.map(unit => unit.main_image).filter(e => e);
    });

    p_schema.pre("save", async function() {
        const doc = this;
        const products = await Product.find();
        const found = products.find(p => p.id != doc.id && p.link === doc.link);
        if (found) throw Error("Cannot save product with the same name as another");
    });

    return p_schema;
})());

Product._deleteMany = async query => {
    const products = await Product.find(query);
    const images = products.map(p => p.units).flat().map(u => u.images).flat();
    const p_ids = images.map(img => img.p_id);

    await cloud.api.delete_resources(p_ids).catch(e => e);
    return await Product.deleteMany(query);
}

Product.deleteByIds = async ids => {
    ids = [ids].flat().filter(e => e);
    if (!ids.length) throw Error("Missing product ID(s) required for deletion");
    return await Product._deleteMany({ _id : { $in: ids } });
}

Product.deleteUnitsByIds = async unit_ids => {
    unit_ids = [unit_ids].flat().filter(e => e);
    if (!unit_ids.length) throw Error("Missing unit ID(s) required for deletion");

    const products = await Product.find({ "units._id": { $in: unit_ids } });
    const units = products.map(p => p.units).flat().filter(u => unit_ids.includes(u.id));
    const p_ids = units.map(u => u.images).flat().map(img => img.p_id);

    await cloud.api.delete_resources(p_ids).catch(e => null);

    await each(products, (p, cb) => {
        p.units = p.units.filter(u => !unit_ids.includes(u.id));
        p.save(e => e ? cb(e) : cb());
    });
}
