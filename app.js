const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const cloud = require('cloudinary').v2;
const { OAuth2 } = (require("googleapis")).google.auth;
const { platforms, product_sizes, placeholder_product_image, subject_options } = require('./config/constants');
const SiteContent = require('./models/SiteContent');
const MailTransporter = require('./modules/mail-transporter');
const visitor = require('./modules/visitor-info');
const checkout_cancel = require('./modules/checkout-cancel');
const paginate = require('./modules/paginate');
const { SIMDB, PORT, NODE_ENV, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const production = NODE_ENV === "production";

mongoose.set({ strictQuery: true }).connect(SIMDB).then(() => { console.log("Connected to DB") });

cloud.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); // set static folder

app.use(session({ // express session
    secret: 'secret',
    name: 'sesh' + require("crypto").randomBytes(20).toString("hex"),
    saveUninitialized: true,
    resave: true,
    cookie: { secure: 'auto', maxAge: 1000 * 60 * 60 * 12 },
    store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 12 })
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => { // global variables
    req.hostname != "localhost" && res.on("finish", () => console.log(visitor(req, res)));
    res.locals.production = req.session.production = production;
    res.locals.url = req.originalUrl;
    res.locals.location_origin = MailTransporter.location_origin = `${req.protocol}://${req.headers.host}`;
    res.locals.cart = req.session.cart = Array.isArray(req.session.cart) ? req.session.cart : [];
    res.locals.price_total = req.session.price_total = () => req.session.cart.reduce((p, c) => p + (c.unit.price * c.quantity), 0);
    res.locals.paginate = paginate;
    res.locals.platforms = platforms;
    res.locals.placeholder_product_image = placeholder_product_image;
    res.locals.product_sizes = product_sizes;
    res.locals.subject_options = subject_options;
    res.locals.site_content = await SiteContent.findOne();

    if (!req.session.checkout_session_id || /^\/shop\/checkout\/(cancel|session\/complete)$/.test(req.originalUrl)) return next();
    checkout_cancel(req, res, next);
});

app.use('/', require('./routes/index'));
app.use('/admin', require('./routes/admin'));
app.use('/shop', require('./routes/shop'));
app.use('/shop/product', require('./routes/product'));
app.use('/shop/checkout', require('./routes/checkout'));
app.use('/site/content', require('./routes/site-content'));
app.use('/test', require('./routes/test'));

app.get("*", (req, res) => {
    const status = [200, 404].includes(res.statusCode) ? 404 : res.statusCode;
    const html = `<h1>PAGE ${res.statusCode === 404 ? "IN CONSTRUCTION" : "NOT FOUND"}</h1>`;
    res.status(status).render('error', { html });
});

app.post("*", (req, res) => res.status(400).send("Sorry, your request currently cannot be processed"));

app.listen(PORT, async () => {
    console.log("Server started" + (!production ? " on port " + PORT : ""));

    if (production) setInterval(async () => {
        try {
            const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN } = process.env;
            const oauth2Client = new OAuth2( OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, "https://developers.google.com/oauthplayground" );
            oauth2Client.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
            const response = await oauth2Client.getAccessToken();
            if (!response.token) throw Error("Null token");
        } catch (err) { console.error(err.message) }
    }, 1000 * 60 * 60 * 24 * 7);
});
