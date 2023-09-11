const router = require('express').Router();
const MailTransporter = require('../modules/mail-transporter');
const Product = require('../models/Product');
const SiteContent = require('../models/SiteContent');
// const recaptcha = require('../modules/recaptcha');
const { DOMAIN_EMAIL, RECAPTCHA_SITE_KEY } = process.env;

router.get('/', async (req, res) => {
    const products = await Product.find();
    res.render('index', { products, recaptcha_site_key: RECAPTCHA_SITE_KEY })
});

router.get('/shop', async (req, res) => res.redirect("/#shop"));
router.get('/about', async (req, res) => res.redirect("/#about"));
router.get('/contact', async (req, res) => res.redirect("/#contact"));

router.post('/contact/mail/send', /*recaptcha,*/ async (req, res) => {
    const { firstname, lastname, email, message } = req.body;
    const subject = "New message / enquiry";
    const msg = `New message from <b>${firstname} ${lastname} (${email})</b>:\n\n${message}`;
    new MailTransporter({ email: DOMAIN_EMAIL }).sendMail({ subject, message: msg }, err => {
        if (err) return res.status(500).send(err.message);
        res.send("Email sent");
    });
});

router.post('/site/content/update', async (req, res) => {
    const { homepage_image, about_info, platform_name: sn, socials_url: su } = req.body;
    const content = await SiteContent.findOne() || new SiteContent();
    content.about_info = about_info;

    const platform_names = [sn].flat().filter(e => e);
    const platform_urls = [su].flat();
    if (platform_names.length) {
        if (platform_names.length != platform_urls.length) return res.status(400).send("Number of specified social media names + URLs don't match");
        content.platforms = platform_names.reduce((arr, name, i) => {
            platform_urls[i] && arr.push({ name, url: platform_urls[i] });
            return arr;
        }, []);
    }

    if (homepage_image) content.home_main_image.url = homepage_image;

    const fields_changed = content.modifiedPaths().join(", ").replace(/_/g, " ");
    const message = fields_changed ? "Site contents updated: " + fields_changed : "No changes made";

    await content.save();
    res.send(message);
});

module.exports = router;
