const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Admin, ShippingMethod, Order } = require('../models/models');
const Product = require('../models/Product');
const SiteContent = require('../models/SiteContent');
const isAuthed = require('../modules/auth-check');
const passport = require('../config/passport');
const MailTransporter = require('../modules/mail-transporter');
const { delivery_est_units } = require('../config/constants');
const email = process.env.DOMAIN_EMAIL;

router.get('/', isAuthed, async (req, res) => {
    const products = await Product.find();
    const orders = await Order.find();
    const content = await SiteContent.find();
    const shipping = await ShippingMethod.find();
    res.render('admin', { products, orders, content, shipping, delivery_est_units });
});

router.get('/login', async (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    const admin = await Admin.findOne({ email });
    res.render('admin-login', { admin })
});

router.get('/activate/:token', async (req, res, next) => {
    const found = await Admin.findOne({ token: req.params.token, token_expiry_date: { $gte: Date.now() } });
    if (!found) return next();
    res.render('admin-activate', { token: found.token })
});

router.get('/password/reset/:token', async (req, res, next) => {
    const found = await Admin.findOne({ email, token: req.params.token, token_expiry_date: { $gte: Date.now() } });
    if (!found) return next();
    res.render('admin-password-reset', { token: found.token })
});

router.post('/login', (req, res) => {
    req.body.username = email;
    Object.freeze(req.body);
    passport.authenticate("local-login-admin", async (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        if (user === "to_activate") {
            await Admin.deleteMany({ email: "temp" });
            const token = crypto.randomBytes(20).toString("hex");
            const token_expiry_date = new Date(Date.now() + (1000 * 60 * 60 * 2));
            const doc = await Admin.create({ email: "temp", password: "temp", token, token_expiry_date });
            const subject = "Admin Account Activation";
            const message = "You're recieving this email because an admin account needs setting up. " +
                "Please click the link below to activate the account, as this will only be " +
                "<u>available for the next 2 hours</u> from the time of this email received:\n\n" +
                `${res.locals.location_origin}/admin/activate/${doc.token}\n\n`;
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

router.post("/activate/:token", (req, res) => {
    req.body.username = email;
    Object.freeze(req.body);
    passport.authenticate("local-register-admin", async (err, user, info) => {
        if (err) return res.status(500).send(err.message || err);
        if (!user) return res.status(400).send(info.message);
        await Admin.deleteMany({ email: "temp" });
        res.send({ href: '/admin/login' });
    })(req, res);
});

router.post('/password/reset/send-email', async (req, res) => {
    const token = crypto.randomBytes(20).toString("hex");
    const token_expiry_date = new Date(Date.now() + (1000 * 60 * 60 * 2));
    const admin = await Admin.findOneAndUpdate({ email }, { token, token_expiry_date }, { new: true });
    if (!admin) return res.status(404).send("No admin account found");

    const subject = "Password Reset";
    const message = "You're recieving this email because you requested a password reset.\n" +
        "Please click the link below to create a new password:\n\n" +
        `${res.locals.location_origin}/admin/password/reset/${admin.token}\n\n` +
        "Please note: the link will only be available for the next 2 hours.";
    new MailTransporter({ email }).sendMail({ subject, message }, err => {
        if (err) return res.status(500).send(err.message || err);
        res.status(400).send("Password reset email sent");
    });
});

router.post('/password/reset/:token', async (req, res) => {
    const { password: pass, password_confirm } = req.body;
    if (pass !== password_confirm) return res.status(400).send("Passwords don't match");

    const { token } = req.params;
    const token_expiry_date = { $gte: Date.now() };
    const password = await bcrypt.hash(pass, 10);
    const updates = { password, $unset: { token: "", token_expiry_date: "" } };
    const admin = await Admin.findOneAndUpdate({ email, token, token_expiry_date }, updates, { new: true });
    if (!admin) return res.status(404).send("Invalid / expired token, or admin account does not exist");
    res.send({ href: '/admin/login' });
});

router.post('/search', isAuthed, async (req, res) => {
    const products = (await Product.find()).map(p => p.toObject({ virtuals: true }));
    const content = await SiteContent.find();
    res.send([...products, ...content]);
});

module.exports = router;
