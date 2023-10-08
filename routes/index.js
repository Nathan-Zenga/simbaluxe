const router = require('express').Router();
const MailTransporter = require('../modules/mail-transporter');
const Product = require('../models/Product');
const { ShippingMethod } = require('../models/models');
const isAuthed = require('../modules/auth-check');
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
    const { name, email, subject, message: msg } = req.body;
    const message = `Message from <b>${name} (${email})</b>:\n\n${msg}`;
    new MailTransporter({ email: DOMAIN_EMAIL }).sendMail({ subject, message }, err => {
        if (err) return res.status(500).send(err.message);
        res.send("Email sent");
    });
});

router.post('/shipping/fee/update', isAuthed, async (req, res) => {
    const { fee, min_value, min_unit, max_value, max_unit } = req.body;
    const shipping = await ShippingMethod.findOne() || new ShippingMethod();

    try {
        shipping.fee = fee;
        shipping.delivery_estimate.minimum.value = min_value;
        shipping.delivery_estimate.maximum.value = max_value;
        shipping.delivery_estimate.minimum.unit = min_unit;
        shipping.delivery_estimate.maximum.unit = max_unit;
        await shipping.save(); res.send("Shipping method details saved!");
    } catch (err) { res.status(400).send(err.message) }
});

module.exports = router;
