import Checkout from "../models/Checkout.js";
import { instance } from "../index.js";
import crypto from "crypto";
import dotenv from "dotenv";
import User from "../models/User.js";
import CourseDetails from "../models/CourseDetails.js";

dotenv.config();
export const checkout = async (req, res) => {
    try {
        const {
            userId,
            fullname,
            phoneno,
            email,
            address,
            packagename,
            coursename,
            amount,
        } = req.body;
        const options = {
            amount: Number(req.body.amount * 100),
            currency: "INR",
            notes: {
                userId,
                fullname,
                phoneno,
                email,
                address,
                packagename,
                coursename,
            },
        };
        const order = await instance.orders.create(options);
        // :white_tick: SAVE BEFORE PAYMENT (CRITICAL)
        await Checkout.create({
            userId,
            fullname,
            phoneno,
            email,
            address,
            packagename,
            coursename,
            amount,
            razorpay_order_id: order.id,
            paymentStatus: "pending",
        });
        res.status(200).json({ success: true, order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};


//Razorpay Webhook
export const razorpayWebhook = async (req, res) => {
    console.log(":bell: RAZORPAY WEBHOOK HIT");
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const body = req.body; // RAW BUFFER
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(body)
            .digest("hex");
        if (signature !== expectedSignature) {
            console.log(":x: Invalid Signature");
            return res.status(400).json({ message: "Invalid signature" });
        }
        const event = JSON.parse(body.toString());
        console.log(":envelope_with_arrow: Event received:", event.event);
        /* =========================
           HANDLE ORDER.PAID
        ==========================*/
        if (event.event === "order.paid") {
            const order = event.payload.order.entity;
            const orderId = order.id;
            console.log(":white_tick: Order Paid:", orderId);
            const checkout = await Checkout.findOne({
                razorpay_order_id: orderId,
            });
            if (!checkout) {
                console.log(":x: Checkout not found");
                return res.status(200).json({ status: "not_found" });
            }
            if (checkout.paymentStatus === "paid") {
                return res.status(200).json({ status: "already_paid" });
            }
            checkout.paymentStatus = "paid";
            const payment = event.payload.payment?.entity;
            checkout.razorpay_payment_id = payment?.id || null;
            await checkout.save();
            await handleBusinessLogic(checkout);
            console.log(":tada: Payment marked PAID via order.paid");
        }
        return res.status(200).json({ status: "ok" });
    } catch (err) {
        console.error(":x: Webhook error:", err);
        return res.status(500).json({ message: "Webhook error" });
    }
};


//handle Business logic
const handleBusinessLogic = async (checkout) => {
    const {
        userId,
        fullname,
        phoneno,
        email,
        address,
        packagename,
        coursename,
        amount,
    } = checkout;
    const pointsToAdd = getPointsForAmount(amount);
    const validityMonths = getValidityForAmount(amount);
    const user = await User.findOne({ userId });
    if (!user) return;
    const now = new Date();
    const newValidityEnd = new Date(now);
    newValidityEnd.setMonth(newValidityEnd.getMonth() + validityMonths);
    // :white_tick: POINTS (UNCHANGED)
    user.selfPoints = (user.selfPoints || 0) + pointsToAdd;
    user.totalSelfPoints = (user.totalSelfPoints || 0) + pointsToAdd;
    await user.save();
    let courseDetails = await CourseDetails.findOne({ userId });
    const newPurchase = {
        courseName: coursename,
        packageName: packagename,
        amount,
        date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        status: "completed",
    };
    if (!courseDetails) {
        courseDetails = new CourseDetails({
            userId,
            name: fullname,
            courseName: coursename,
            packageName: packagename,
            validityStart: now,
            validityEnd: newValidityEnd,
            purchaseHistory: [newPurchase],
        });
    } else {
        const currentEnd = new Date(courseDetails.validityEnd);
        if (currentEnd < now) {
            courseDetails.validityStart = now;
            courseDetails.validityEnd = newValidityEnd;
        } else {
            currentEnd.setMonth(currentEnd.getMonth() + validityMonths);
            courseDetails.validityEnd = currentEnd;
        }
        courseDetails.purchaseHistory.push(newPurchase);
    }
    await courseDetails.save();
};



export const paymentverification_students = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        fullname,
        userId,
        phoneno,
        email,
        address,
        packagename,
        coursename,
        amount,
    } = req.body;

    try {
        // ✅ Step 1: Verify Razorpay signature
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_API_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest("hex");

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        // ✅ Step 2: Save payment details to Checkout collection
        const paymentDetails = new Checkout({
            fullname,
            userId,
            phoneno,
            address,
            email,
            packagename,
            coursename,
            amount,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        });

        const pointsToAdd = getPointsForAmount(amount);
        const validityMonths = getValidityForAmount(amount);
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const now = new Date();
        const newValidityEnd = new Date(now);
        newValidityEnd.setMonth(newValidityEnd.getMonth() + validityMonths);

        // ✅ Step 3: Update user points
        user.selfPoints = (user.selfPoints || 0) + pointsToAdd;
        user.totalSelfPoints = (user.totalSelfPoints || 0) + pointsToAdd;
        await user.save();
        await paymentDetails.save();

        // ✅ Step 4: Course details update with validity logic
        let courseDetails = await CourseDetails.findOne({ userId });

        const newPurchase = {
            courseName: coursename,
            packageName: packagename,
            amount,
            date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            status: "completed",
        };

        if (!courseDetails) {
            // 🆕 No previous record → Create new
            courseDetails = new CourseDetails({
                userId,
                name: fullname,
                courseName: coursename,
                packageName: packagename,
                validityStart: now,
                validityEnd: newValidityEnd,
                purchaseHistory: [newPurchase],
            });
        } else {
            // 🧠 Has previous record → Check validity logic
            const currentEnd = new Date(courseDetails.validityEnd);
            let updatedStart = now;
            let updatedEnd;

            if (currentEnd < now) {
                // ⏰ Course expired → reset validity
                updatedEnd = new Date(now);
                updatedEnd.setMonth(updatedEnd.getMonth() + validityMonths);
            } else {
                // 🔁 Course still active → extend validity
                updatedEnd = new Date(currentEnd);
                updatedEnd.setMonth(updatedEnd.getMonth() + validityMonths);
                updatedStart = courseDetails.validityStart; // keep the old start date
            }

            // 📝 Update fields
            courseDetails.courseName = coursename;
            courseDetails.packageName = packagename;
            courseDetails.validityStart = updatedStart;
            courseDetails.validityEnd = updatedEnd;
            courseDetails.purchaseHistory.push(newPurchase);
        }

        await courseDetails.save();

        console.log("✅ Payment verified & Course validity updated successfully.");

        // ✅ Step 5: Respond success
        return res.status(200).json({
            success: true,
            message: "Payment successful & course validity updated.",
            data: {
                userId,
                coursename,
                packagename,
                validityStart: courseDetails.validityStart,
                validityEnd: courseDetails.validityEnd,
                pointsAdded: pointsToAdd,
            },
        });

    } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(400).json({ success: false, message: "Payment verification failed", error: error.message });
    }
};


// utils/getPoints.js
export const getPointsForAmount = (amount) => {
    const mapping = {
        944: 800,
        1770: 1500,
        3540: 3000,
        7080: 6000,
        11800: 10000,
        59000: 25000,
    };
    // Round off to handle small differences (e.g., decimals)
    const roundedAmount = Math.round(amount);
    // Return the corresponding points, or 0 if not matched
    return mapping[roundedAmount] || 0;
};


// utils/getValidity.js
export const getValidityForAmount = (amount) => {
    const mapping = {
        944: 1,     // 1 month
        1770: 1,    // 1 months
        3540: 3,    // 3 months
        7080: 6,   // 6 month
        11800: 12,  // 1 year
        59000: 12,  // 1 year
    };
    const roundedAmount = Math.round(amount);
    return mapping[roundedAmount] || 0;
};


export const getorderdetails_by_userid = async (req, res) => {
    try {
        const { userId } = req.body;  // get userId from POST request body
        console.log("Fetching orders for userId:", userId);
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        // find all orders for this user
        const orderDetails = await Checkout.find({ userId: userId });
        if (!orderDetails || orderDetails.length === 0) {
            return res.status(404).json({ error: "No orders found for this user" });
        }
        console.log("Order details fetched:", orderDetails);
        res.status(200).json(orderDetails); // send array of orders
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: err.message });
    }
};


//checkout details by user id
export const getUserCheckoutDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const checkoutDetails = await Checkout.find({ userId });

        if (!checkoutDetails.length) {
            return res.status(404).json({ message: "No checkout records found for this user" });
        }

        res.status(200).json({
            success: true,
            message: "Checkout details fetched successfully",
            data: checkoutDetails,
        });
    } catch (error) {
        console.error("Error fetching checkout details:", error);
        res.status(500).json({ success: false, message: "Failed to fetch checkout details" });
    }
};