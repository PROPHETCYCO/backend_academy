import User from '../models/User.js';

const LEVEL_PERCENTAGES = {
    2: 0.12,
    3: 0.08,
    4: 0.03,
    5: 0.02,
    6: 0.01,
    7: 0.008,
    8: 0.008,
    9: 0.008,
    10: 0.008,
};

export const calculateRealtimeReferralPoints = async (userId, currentLevel = 1, visited = new Set(), userMap = null) => {
    try {
        if (currentLevel > 10) return 0;

        // Step 1️⃣: Load all users into memory once (optimization)
        if (!userMap) {
            const allUsers = await User.find({}, { userId: 1, referredIds: 1, selfPoints: 1 });
            userMap = new Map(allUsers.map(u => [u.userId, u]));
        }

        // Step 2️⃣: Prevent infinite recursion
        if (visited.has(userId)) return 0;
        visited.add(userId);

        const user = userMap.get(userId);
        if (!user || !user.referredIds?.length) return 0;

        let totalReferralPoints = 0;

        for (const childId of user.referredIds) {
            const child = userMap.get(childId);
            if (!child) continue;

            // Apply level percentage if applicable
            if (LEVEL_PERCENTAGES[currentLevel + 1]) {
                totalReferralPoints += (child.selfPoints || 0) * LEVEL_PERCENTAGES[currentLevel + 1];
            }

            // Recursive call (deeper levels)
            const downlinePoints = await calculateRealtimeReferralPoints(childId, currentLevel + 1, visited, userMap);
            totalReferralPoints += downlinePoints;
        }

        return totalReferralPoints;
    } catch (error) {
        console.error("Error calculating referral points:", error);
        return 0;
    }
};


export const calculateReferralPoints = async (
    userId,
    currentLevel = 1,
    visited = new Set(),
    userMap = null
) => {
    try {
        if (currentLevel > 10) return { referralPoints: 0, directReferralPoints: 0 };

        // Load all users into memory once
        if (!userMap) {
            const allUsers = await User.find({}, { userId: 1, referredIds: 1, selfPoints: 1 });
            userMap = new Map(allUsers.map(u => [u.userId, u]));
        }

        // Prevent circular recursion
        if (visited.has(userId)) return { referralPoints: 0, directReferralPoints: 0 };
        visited.add(userId);

        const user = userMap.get(userId);
        if (!user || !user.referredIds?.length)
            return { referralPoints: 0, directReferralPoints: 0 };

        let referralPoints = 0;
        let directReferralPoints = 0;

        for (const childId of user.referredIds) {
            const child = userMap.get(childId);
            if (!child) continue;

            // ✅ Direct referred points = sum of selfPoints of direct referrals
            if (currentLevel === 1) {
                directReferralPoints += child.selfPoints || 0;
            }

            // ✅ Recursive call for deeper levels (exclude direct referrals from referralPoints)
            const downlineData = await calculateReferralPoints(
                childId,
                currentLevel + 1,
                visited,
                userMap
            );

            // Only add points from levels deeper than 1
            referralPoints += (currentLevel === 1 ? 0 : child.selfPoints || 0) + downlineData.referralPoints;
        }

        return { referralPoints, directReferralPoints };
    } catch (error) {
        console.error("❌ Error calculating referral points:", error);
        return { referralPoints: 0, directReferralPoints: 0 };
    }
};