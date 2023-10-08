const router = require('express').Router();
const Product = require('../models/Product');
const SiteContent = require('../models/SiteContent');
const fs = require('fs');
const path = require('path');
const testDataString = filename => fs.readFileSync(path.join(__dirname, `../test/files/${filename}`)).toString();
const cloud = require('cloudinary').v2;

router.use((req, res, next) => req.session.production ? res.redirect("/") : next());

router.get('/product/create', async (req, res) => {
    try {
        const products = JSON.parse(testDataString("products.json"));
        const saved = await Product.create(products);
        res.send(saved);
    } catch(e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

router.get('/product/list/:id?', async (req, res) => {
    try {
        const result = await Product.find(req.params.id ? { _id: req.params.id } : {});
        res.send(result);
    } catch(e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

router.get('/site/content/update', async (req, res) => {
    try {
        const { home_main_image } = req.query;
        const content = await SiteContent.findOne() || new SiteContent();
        content.about_info = testDataString("about-info.txt");
        content.home_main_image.url = home_main_image;
        content.platforms = [{ name: "Twitter", url: "https://example.com" }];
        content.platforms.push({ name: "Instagram", url: "https://example.com" });

        const saved = await content.save();
        res.send(saved);
    } catch(e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

router.get('/site/content/media/delete', async (req, res) => {
    try {
        const result = await SiteContent.deleteMedia(req.query.field);
        res.send(result);
    } catch(e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

router.get('/cloud/resources', async (req, res) => {
    try {
        const resources = await cloud.api.resources({ type: "upload", prefix: "simbaluxe/test/products/A_Good_Wig", max_results: 500 });
        res.send(resources);
    } catch(e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

module.exports = router;
