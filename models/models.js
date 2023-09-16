const { model, Schema } = require('mongoose');
Schema.Types.String.set('trim', true);
Schema.Types.Number.set('default', 0);

module.exports.Admin = model('Admin', new Schema({
    email: { type: String, index: true, required: true },
    password: { type: String, required: true },
    token_expiry_date: Date
}));

module.exports.Order = model('Order', new Schema({
    reciept_link: { type: String, required: true },
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));
