import mongoose from "mongoose";
const checkoutSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    phoneno: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    packagename: {
        type: String,
        required: true
    },
    coursename: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    razorpay_order_id: {
        type: String,
        required: true
    },
    razorpay_payment_id: {
        type: String,
        default: null,
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
const Checkout = mongoose.model("Checkout", checkoutSchema);
export default Checkout;