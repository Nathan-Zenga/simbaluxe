const Stripe = new (require('stripe').Stripe)(process.env.STRIPE_SK);

module.exports = async (req, res, next) => {
    if (/^\/shop\/checkout\/session\/complete$/i.test(req.originalUrl)) return next();
    const { checkout_session_id } = req.session;

    if (checkout_session_id) try {
        const session = await Stripe.checkout.sessions.retrieve(checkout_session_id);
        if (session.payment_status != "paid") await Stripe.customers.del(session.customer);
        if (session.status == "open") await Stripe.checkout.sessions.expire(session.id);
    } catch {}

    req.session.checkout_session_id = undefined;
    next();
}