const Stripe = new (require('stripe').Stripe)(process.env.STRIPE_SK);

module.exports = async (req, res, next) => {
    if (/^\/shop\/checkout\/session\/complete$/i.test(req.originalUrl)) return next();
    const { checkout_session_id } = req.session;

    if (checkout_session_id) try {
        const session = await Stripe.checkout.sessions.retrieve(checkout_session_id, { expand: ["customer", "payment_intent"] });
        const { customer, payment_intent: pi, payment_status } = session;
        if (payment_status != "paid") await Stripe.customers.del(customer?.id);
        if (pi.status != "succeeded") await Stripe.paymentIntents.cancel(pi.id, { cancellation_reason: "requested_by_customer" });
    } catch {}

    req.session.checkout_session_id = undefined;
    next();
}