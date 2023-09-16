const router = require('express').Router();
const MailTransporter = require('../modules/mail-transporter');
const Product = require('../models/Product');
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
    const { firstname, lastname, email, subject, message: msg } = req.body;
    const message = `Message from <b>${firstname} ${lastname} (${email})</b>:\n\n${msg}`;
    new MailTransporter({ email: DOMAIN_EMAIL }).sendMail({ subject, message }, err => {
        if (err) return res.status(500).send(err.message);
        res.send("Email sent");
    });
});

module.exports = router;
