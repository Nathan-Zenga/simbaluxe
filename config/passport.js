const { Strategy } = require('passport-local');
const { Admin } = require('../models/models');
const bcrypt = require('bcrypt');
const passport = require('passport');

passport.use("local-login-admin", new Strategy(async (email, password, done) => {
    try {
        const user = await Admin.findOne({ email });
        const match = await bcrypt.compare(password, user?.password || "");
        if (!user) return done(null, "to_activate", { message: "Verification email sent" });
        if (!match) return done(null, null, { message: "Invalid password" });
        done(null, user);
    } catch (err) { done(err) }
}));

passport.use("local-register-admin", new Strategy({ passReqToCallback: true }, async (req, email, password, done) => {
    try {
        if (password !== req.body.password_confirm) return done(null, null, { message: "Passwords don't match" });
        const applicant = await Admin.findOne({ password: req.params.token, token_expiry_date: { $gte: Date.now() } });
        const existing = await Admin.findOne({ email });
        if (!applicant) return done(null, null, { message: "Cannot activate account: expired / invalid token" });
        if (existing) return done(null, null, { message: "An admin is already registered" });
        const hash = await bcrypt.hash(password, 10);
        const user = await Admin.create({ email, password: hash });
        done(null, user);
    } catch (err) { done(err) }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const queries = [Admin.findById(id)];
        const user = (await Promise.all(queries)).find(u => u);
        done(null, user);
    } catch (err) { done(err) }
});

module.exports = passport;
