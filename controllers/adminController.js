import User from '../models/User.js';
import Checkout from '../models/Checkout.js';

export const getDashboardStats = async (req, res) => {
    try {
        // 1️⃣ Total users count
        const totalUsers = await User.countDocuments();

        // 2️⃣ Total amount (all-time)
        const totalData = await Checkout.aggregate([
            {
                $match: { paymentStatus: "paid" },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ]);

        const totalAmount = totalData.length > 0 ? totalData[0].totalAmount : 0;

        // 3️⃣ Current month amount
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const currentMonthData = await Checkout.aggregate([
            {
                $match: {
                    paymentStatus: "paid",
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                },
            },
            {
                $group: {
                    _id: null,
                    currentMonthAmount: { $sum: "$amount" },
                },
            },
        ]);

        const currentMonthAmount =
            currentMonthData.length > 0 ? currentMonthData[0].currentMonthAmount : 0;

        // 4️⃣ Response
        res.status(200).json({
            success: true,
            message: "Dashboard stats fetched successfully",
            data: {
                totalUsers,
                totalAmount,
                currentMonthAmount,
                currentMonth: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
            },
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats",
            error: error.message,
        });
    }
};