const router = require('express').Router();
const { STRIPE_SK, STRIPE_PK } = process.env;
const Stripe = new (require('stripe').Stripe)(STRIPE_SK);
const { Order, ShippingMethod } = require('../models/models');
const Product = require('../models/Product');
const MailTransporter = require('../modules/mail-transporter');
const checkout_cancel = require('../modules/checkout-cancel');
const number_separator_regx = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;
const countries = require("../modules/country-list");

router.get('/', async (req, res) => {
    if (req.session.cart_count() == 0) return res.redirect(req.get("referrer"));
    res.render("checkout", { countries })
});

router.post("/session/create", async (req, res) => {
    const { firstname, lastname, email, address_l1, address_l2, city, state, country: country_name, postcode } = req.body;
    if (req.session.cart_count() == 0) return res.status(400).send("Cannot continue checkout:\nyour cart is empty");

    const field_check = { firstname, lastname, email, "address line 1": address_l1, city, country: country_name, "post / zip code": postcode };
    const missing_fields = Object.keys(field_check).filter(k => !field_check[k]);
    const email_pattern = /^(?:[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
    if (missing_fields.length) return res.status(400).send(`Missing fields: ${missing_fields.join(", ")}`);
    if (!email_pattern.test(email)) return res.status(400).send("Invalid email format");

    try {
        const name = `${firstname} ${lastname}`;
        const country = countries.find(c => c.name === country_name);
        const address = { line1: address_l1, line2: address_l2, city, state, country: country.code, postal_code: postcode };
        const customer = await Stripe.customers.create({ name, email, shipping: { name, address } });

        const line_items = req.session.cart.map(item => ({
            price_data: {
                product_data: {
                    name: item.name,
                    description: item.unit.unit_description,
                    images: item.unit.images.map(img => img.url)
                },
                unit_amount: item.unit.price * 100,
                currency: "gbp"
            },
            quantity: item.quantity
        }));

        const shipping_method = await ShippingMethod.findOne();
        const shipping_options = [shipping_method].filter(e => e).map(method => ({
            shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: method.fee, currency: "gbp" },
                display_name: "Delivery",
                delivery_estimate: {
                    minimum: {
                        unit: method.delivery_estimate.minimum.unit.toLowerCase().replace(/ /g, "_"),
                        value: method.delivery_estimate.minimum.value
                    },
                    maximum: {
                        unit: method.delivery_estimate.maximum.unit.toLowerCase().replace(/ /g, "_"),
                        value: method.delivery_estimate.maximum.value
                    }
                }
            }
        }));

        const session = await Stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            customer: customer.id,
            payment_intent_data: { description: "Simbaluxe Online Store Purchase" },
            line_items,
            shipping_options,
            mode: "payment",
            success_url: res.locals.location_origin + "/shop/checkout/session/complete",
            cancel_url: res.locals.location_origin + "/shop/checkout/cancel"
        });

        req.session.checkout_session_id = session.id;
        res.send({ id: session.id, pk: STRIPE_PK });
    } catch(err) {
        console.error(err.message);
        res.status(err.statusCode || 500).send(err.message)
    }
});

router.get("/session/complete", async (req, res) => {
    if (!req.session.cart.length) return res.status(400).render('error', { html: "Unable to complete checkout - session expired" });

    const { checkout_session_id, cart, production } = req.session;

    try {
        const session = await Stripe.checkout.sessions.retrieve(checkout_session_id, { expand: ["customer", "payment_intent.latest_charge"] });
        if (!session) return res.status(400).render('checkout-error', {
            title: "Payment Error",
            pagename: "checkout-error",
            error: "The checkout session is expired, already completed or invalid"
        });

        const { customer, payment_intent: pi } = session;
        const { receipt_url } = pi.latest_charge;

        if (production) {
            const products = await Product.find();
            await Promise.all(cart.map(item => {
                const product = products.find(p => p.id === item.id);
                const unit = product?.units.find(u => u.unit_description === item.unit.unit_description);
                if (!unit) return null;
                unit.unit_stock_qty = Math.max(0, unit.unit_stock_qty - item.qty);
                return product.save();
            }));

            const { name, email } = customer;
            await Order.create({ reciept_link: receipt_url, customer: { name, email } });
        }

        res.locals.cart = req.session.cart = [];
        req.session.checkout_session_id = undefined;

        const { line1, line2, city, postal_code, state, country: c_code } = customer.shipping.address;
        const country = countries.find(c => c.code === c_code);
        const date = new Date(pi.created * 1000).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        const transporter = new MailTransporter();
        const subject = "Purchase Nofication: Payment Successful";
        const message = `Hi ${customer.name},\n\n` +
        `Your payment was successful. Please see below for your purchase receipt:\n\n${receipt_url}\n\n` +
        "Thank you for shopping with us!\n\n- CS";

        transporter.setRecipient({ email: customer.email }).sendMail({ subject, message }, err => {
            if (err) console.error(err), res.status(500);

            const subject = "Purchase Report: You Got Paid!";
            const message = "You've received a new purchase from a new customer. Summary shown below\n\n" +
            `- Name: ${customer.name}\n- Email: ${customer.email}\n` +
            `- Address:\n\t${line1},${line2 ? "\n\t"+line2+"," : ""}\n\t${city}, ${country.name},` + (state ? ` ${state},` : "") + `\n\t${postal_code}\n\n` +
            `- Date of purchase: ${date}\n\n` +
            `- Total amount: £ ${(pi.amount / 100).toFixed(2).replace(number_separator_regx, ",")}` +
            `\n\nAnd finally, a copy of their receipt:\n${receipt_url}`;

            transporter.setRecipient({ email: "info@thecs.co" }).sendMail({ subject, message }, err => {
                if (err) { console.error(err); if (res.statusCode !== 500) res.status(500) }
                res.render('checkout-success')
            });
        });
    } catch(err) { res.status(err.statusCode || 400).render('error', { html: `<p>${err.message}</p>` }) }
});

router.get("/cancel", checkout_cancel, (req, res) => {
    res.render('checkout-cancel', { title: "Payment Cancelled", pagename: "checkout-cancel" });
});

module.exports = router;
