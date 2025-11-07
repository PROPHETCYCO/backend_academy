import User from "../models/User.js";
import Payout from "../models/Payout.js";
import { calculateRealtimeReferralPoints, calculateReferralPoints } from "../utils/calculateReferralPoints.js";

// GET /api/referral/realtime/:userId
export const getRealtimeReferralPoints = async (req, res) => {
    try {
        const { userId, name } = req.body;

        if (!userId || !name) {
            return res.status(400).json({
                success: false,
                message: "userId and name are required.",
            });
        }

        // ✅ Find the main user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        // ✅ Step 1: Calculate Direct Team Points (12% of each direct’s selfPoints)
        let directReferredPoints = 0;

        if (user.referredIds && user.referredIds.length > 0) {
            const directTeam = await User.find({ userId: { $in: user.referredIds } });

            directReferredPoints = directTeam.reduce((total, member) => {
                const points = (member.selfPoints || 0) * 0.12;
                return total + points;
            }, 0);
        }

        // ✅ Step 2: Calculate Multi-level Referral Points
        const referredPoints = await calculateRealtimeReferralPoints(userId);
        const { referralPoints, directReferralPoints } = await calculateReferralPoints(userId);
        const referralPoint = referralPoints + directReferralPoints;

        // ✅ Step 3: Save or Update Payout Record
        let payout = await Payout.findOne({ userId });

        if (!payout) {
            // 🆕 Create new payout record
            payout = new Payout({
                userId,
                name,
                totalPoints: 0, // initialized empty
                referredPoints,
                directReferredPoints,
                payouts: [], // empty array
            });
        } else {
            // 🔁 Update existing payout record but KEEP totalPoints as it is
            payout.referredPoints = referredPoints;
            payout.directReferredPoints = directReferredPoints;
            // ✅ Do not change payout.totalPoints (keep existing value)
        }

        await payout.save();

        // ✅ Step 4: Send Response
        return res.status(200).json({
            success: true,
            message: "Referral and direct points calculated successfully.",
            data: {
                userId,
                name,
                directReferredPoints,
                referredPoints,
                referralPoint,
                directReferralPoints,
                totalPoints: payout.totalPoints, // existing totalPoints retained
            },
        });

    } catch (error) {
        console.error("❌ Error in real-time referral calculation:", error);
        res.status(500).json({
            success: false,
            message: "Error calculating real-time referral points",
            error: error.message,
        });
    }
};



//Tree  Api
export const getUserWithReferrals = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find main user
        const mainUser = await User.findOne({ userId });
        if (!mainUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Find referred users using referredIds array
        const referredUsers = await User.find({ userId: { $in: mainUser.referredIds } });

        res.status(200).json({
            success: true,
            message: "User and referred users fetched successfully",
            data: {
                mainUser: {
                    userId: mainUser.userId,
                    name: mainUser.name,
                    email: mainUser.email,
                    phone: mainUser.phone,
                    address: mainUser.address,
                    referralLink: mainUser.referralLink,
                    selfPoints: mainUser.selfPoints,
                    //referredPoints: mainUser.referredPoints,
                    //totalPoints: mainUser.totalPoints,
                    status: mainUser.status,
                },
                referredUsers: referredUsers.map(user => ({
                    userId: user.userId,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    address: user.address,
                    selfPoints: user.selfPoints,
                    //referredPoints: user.referredPoints,
                    //totalPoints: user.totalPoints,
                    status: user.status,
                })),
            },
        });
    } catch (error) {
        console.error("Error fetching user and referrals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch referral details",
            error: error.message,
        });
    }
};