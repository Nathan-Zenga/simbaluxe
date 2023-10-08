const { model, Schema } = require('mongoose');
const { delivery_est_units } = require('../config/constants');
Schema.Types.String.set('trim', true);
Schema.Types.Number.set('default', 0);

module.exports.Admin = model('Admin', new Schema({
    email: { type: String, index: true, required: true },
    password: { type: String, required: true },
    token: String,
    token_expiry_date: Date
}));

module.exports.Order = model('Order', new Schema({
    receipt_link: { type: String, required: true },
    purchase_date: Date,
    customer: {
        name: String,
        email: String
    }
}));

module.exports.Review = model('Review', new Schema({
    headline: String,
    commentry: { type: String, required: true },
    author_name: { type: String, required: true },
    author_verified: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5 },
    images: [{ p_id: String, url: String }]
}, { timestamps: { createdAt: true, updatedAt: true } }));

module.exports.ShippingMethod = model('ShippingMethod', (() => {
    const schema = new Schema({
        delivery_estimate: {
            minimum: { value: { type: Number, min: 1 }, unit: { type: String, enum: delivery_est_units } },
            maximum: { value: { type: Number, min: 1 }, unit: { type: String, enum: delivery_est_units } }
        },
        fee: { type: Number, min: 0, required: true }
    });

    schema.pre("save", function() {
        const min_unit = delivery_est_units.indexOf(this.delivery_estimate.minimum.unit);
        const max_unit = delivery_est_units.indexOf(this.delivery_estimate.maximum.unit);
        if (min_unit > max_unit) throw Error("Minimum delivery estimate cannot be higher than the maximum");

        const min_val = this.delivery_estimate.minimum.value;
        const max_val = this.delivery_estimate.maximum.value;
        this.delivery_estimate.minimum.value = Math.min(min_val, max_val);
        this.delivery_estimate.maximum.value = Math.max(min_val, max_val);
    });

    return schema;
})(), "shipping-method");
