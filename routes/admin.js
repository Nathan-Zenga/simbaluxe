const router = require('express').Router();
const crypto = require('crypto');
const { Admin } = require('../models/models');
const Product = require('../models/Product');
const SiteContent = require('../models/SiteContent');
const isAuthed = require('../modules/auth-check');
const passport = require('../config/passport');
const MailTransporter = require('../modules/mail-transporter');

router.get('/', isAuthed, async (req, res) => {
    const products = await Product.find();
    const content = await SiteContent.find();
    res.render('admin', { products, content });
});

router.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    res.render('admin-login')
});

router.get('/logout', (req, res) => req.logout(() => res.redirect('/')));

router.get('/activate/:token', async (req, res, next) => {
    const found = await Admin.findOne({ password: req.params.token, tokenExpiryDate: { $gte: Date.now() } });
    if (!found) return next();
    res.render('admin-activate', { token: found.password })
});

router.post('/login', (req, res) => {
    req.body.username = process.env.DOMAIN_EMAIL;
    Object.freeze(req.body);
    passport.authenticate("local-login-admin", async (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        if (user === "to_activate") {
            await Admin.deleteMany({ email: "temp" });
            const password = crypto.randomBytes(20).toString("hex");
            const tokenExpiryDate = new Date(Date.now() + (1000 * 60 * 60 * 2));
            const doc = await Admin.create({ email: "temp", password, tokenExpiryDate });
            const subject = "Admin Account Activation";
            const message = "You're recieving this email because an admin account needs setting up. " +
                "Please click the link below to activate the account, as this will only be " +
                "<u>available for the next 2 hours</u> from the time of this email received:\n\n" +
                `${res.locals.location_origin}/admin/activate/${doc.password}\n\n`;
            new MailTransporter({ email }).sendMail({ subject, message }, err => {
                if (err) return res.status(500).send(err.message || err);
                res.status(400).send(info.message);
            });
        } else {
            req.login(user, err => {
                if (err) return res.status(500).send(err.message);
                res.locals.cart = req.session.cart = [];
                res.send({ redirect_to: '/admin' })
            });
        }
    })(req, res);
});

router.post("/activate/:token", async (req, res) => {
    req.body.username = process.env.DOMAIN_EMAIL;
    Object.freeze(req.body);
    passport.authenticate("local-register-admin", (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        req.logIn(user, async err => {
            if (err) return res.status(500).send(err.message || err);
            await Admin.deleteMany({ email: "temp" });
            res.send({ href: '/admin' });
        });
    })(req, res);
});

router.post("/search", isAuthed, async (req, res) => {
    const products = (await Product.find()).map(p => p.toObject({ virtuals: true }));
    const content = await SiteContent.find();
    res.send([...products, ...content]);
});

module.exports = router;
