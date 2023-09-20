const router = require('express').Router();
const SiteContent = require('../models/SiteContent');
const isAuthed = require('../modules/auth-check');

router.post('/home-main-image/update', isAuthed, async (req, res) => {
    const { image_file, image_url } = req.body;
    const content = await SiteContent.findOne() || new SiteContent();
    const image = [image_file, image_url].flat().find(e => e);

    if (!image) return res.status(400).send("No image selected");
    content.home_main_image.url = image;

    try {
        await content.save();
        res.send("Homepage main image updated!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/our-story/update', isAuthed, async (req, res) => {
    const content = await SiteContent.findOne() || new SiteContent();
    content.about_info = req.body.about_info;

    try {
        await content.save();
        res.send("\"Our Story\" info updated!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/platform-links/update', isAuthed, async (req, res) => {
    const { platform_name, platform_url } = req.body;
    const content = await SiteContent.findOne() || new SiteContent();

    const platform_names = [platform_name].flat().filter(e => e);
    const platform_urls = [platform_url].flat().filter(e => e);
    if (platform_names.length != platform_urls.length) return res.status(400).send("Name or URL missing for one (or more) of your social media items");
    content.platforms = platform_names.reduce((arr, name, i) => {
        arr.push({ name, url: platform_urls[i] });
        return arr;
    }, []);

    try {
        await content.save();
        res.send("Platform links updated!");
    } catch (err) {
        res.status(400).send(err.message);
    }
});

module.exports = router;
