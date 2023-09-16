const { model, Schema } = require('mongoose');
const { platforms } = require('../config/constants');
const { each } = require('async');
const cloud = require('cloudinary').v2;
Schema.Types.String.set('trim', true);
Schema.Types.Number.set('default', 0);
const production = process.env.NODE_ENV === "production";

const SiteContent = module.exports = model('SiteContent', (() => {
    const schema = new Schema({
        home_main_image: { p_id: String, url: String },
        about_info: String,
        platforms: [{ name: { type: String, enum: platforms }, url: { type: String, required: true } }]
    });

    schema.pre("save", async function() {
        const test_path = !production ? "test/" : "";
        const public_id = `simbaluxe/${test_path}site-content/homepage-main-image`.replace(/[ ?&#\\%<>+]/g, "_");
        const images_updated = this.modifiedPaths({ includeChildren: true }).includes("home_main_image");

        if (images_updated && this.home_main_image.url) {
            const result = await cloud.uploader.upload(this.home_main_image.url, { public_id });
            this.home_main_image = { p_id: result.public_id, url: result.secure_url };
        }

        if (!this.home_main_image.url && !this.isNew) {
            const content = await SiteContent.findById(this.id);
            this.home_main_image.url = content.home_main_image.url;
        }
    });

    return schema;
})(), "site-content");

SiteContent.deleteMedia = async fields => {
    const content = await SiteContent.findOne();
    if (!content) return null;

    fields = [fields].flat().filter(f => content[f]?.p_id);

    await each(fields, (f, cb) => {
        cloud.api.delete_resources([content[f].p_id], err => {
            content[f] = undefined;
            cb();
        });
    });

    return await content.save();
}
