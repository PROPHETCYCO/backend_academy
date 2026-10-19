import User from "../models/User.js";
import Payout from "../models/Payout.js";
import Checkout from "../models/Checkout.js";
import CourseDetails from "../models/CourseDetails.js";
import {
  calculateRealtimeReferralPoints,
  calculateReferralPoints,
} from "../utils/calculateReferralPoints.js";

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
    let currentdirectReferredpoints = 0;

    if (user.referredIds && user.referredIds.length > 0) {
      const directTeam = await User.find({ userId: { $in: user.referredIds } });

      directReferredPoints = directTeam.reduce((total, member) => {
        const points = (member.selfPoints || 0) * 0.12;
        return total + points;
      }, 0);
    }
    if (user.referredIds && user.referredIds.length > 0) {
      const directTeam = await User.find({ userId: { $in: user.referredIds } });

      currentdirectReferredpoints = directTeam.reduce((total, member) => {
        const points = member.totalSelfPoints || 0;
        return total + points;
      }, 0);
    }

    // ✅ Step 2: Calculate Multi-level Referral Points
    const referredPoints = await calculateRealtimeReferralPoints(userId);
    const { referralPoints, directReferralPoints } =
      await calculateReferralPoints(userId);
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
        currentdirectReferredpoints,
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
        currentdirectReferredpoints,
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


//////coupon code
const generateUniqueCouponCode = async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(
      Math.floor(1000 + Math.random() * 9000)
    );

    const exists = await User.exists({
      couponCode: code,
    });

    if (!exists) {
      return code;
    }
  }

  throw new Error(
    "Unable to generate a unique coupon code. Please try again."
  );
};

const parsePurchaseDate = (dateString) => {
  if (!dateString) return null;

  const match = String(dateString).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)$/i
  );

  if (!match) return null;

  const [
    ,
    day,
    month,
    year,
    hour,
    minute,
    second,
    period,
  ] = match;

  let hours = Number(hour);

  if (period.toLowerCase() === "pm" && hours !== 12) {
    hours += 12;
  }

  if (period.toLowerCase() === "am" && hours === 12) {
    hours = 0;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    Number(minute),
    Number(second)
  );
};

export const getOrCreateCouponCode = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Find the user who may receive the coupon
    const mainUser = await User.findOne({ userId });

    if (!mainUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Existing coupon must never change
    if (mainUser.couponCode) {
      return res.status(200).json({
        success: true,
        eligible: true,
        couponCode: mainUser.couponCode,
        message: "Existing coupon code fetched successfully",
      });
    }

    // 3. Get direct referrals only
    const directTeamIds = mainUser.referredIds || [];

    if (directTeamIds.length === 0) {
      return res.status(200).json({
        success: true,
        eligible: false,
        couponCode: null,
        message: "No direct referrals found",
      });
    }

    // 4. Eligible purchase window: 13 Oct to 30 Oct 2026 inclusive
    // Uses the server's local timezone, consistent with the
    // date parser below.
    const startDate = new Date(2026, 9, 13, 0, 0, 0);
    const endDate = new Date(2026, 9, 31, 0, 0, 0);

    // 5. Get purchase records belonging to direct team members
    const teamCourses = await CourseDetails.find({
      userId: { $in: directTeamIds },
    }).lean();

    // 6. Check the last purchase in each purchaseHistory
    const isEligible = teamCourses.some((course) => {
      const history = course.purchaseHistory || [];

      if (history.length === 0) {
        return false;
      }

      const lastPurchase = history[history.length - 1];

      if (!lastPurchase) {
        return false;
      }

      const purchaseDate = parsePurchaseDate(lastPurchase.date);

      return (
        lastPurchase.status === "completed" &&
        Number(lastPurchase.amount) > 1770 &&
        purchaseDate !== null &&
        !Number.isNaN(purchaseDate.getTime()) &&
        purchaseDate >= startDate &&
        purchaseDate < endDate
      );
    });

    // 7. No qualifying purchase
    if (!isEligible) {
      return res.status(200).json({
        success: true,
        eligible: false,
        couponCode: null,
        message:
          "No qualifying direct-team purchase found for the selected dates",
      });
    }

    // 8. Generate a random 4-digit coupon
   const generatedCode = await generateUniqueCouponCode();

    // 9. Save only when couponCode is still empty
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: mainUser._id,
        $or: [
          { couponCode: null },
          { couponCode: { $exists: false } },
          { couponCode: "" },
        ],
      },
      {
        $set: {
          couponCode: generatedCode,
        },
      },
      {
        new: true,
      }
    );

    // 10. Handle concurrent requests safely
    const finalUser =
      updatedUser ||
      (await User.findById(mainUser._id).select("couponCode"));

    if (!finalUser) {
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve saved coupon code",
      });
    }

    return res.status(200).json({
      success: true,
      eligible: true,
      couponCode: finalUser.couponCode,
      message: updatedUser
        ? "Coupon code generated and saved successfully"
        : "Existing coupon code fetched successfully",
    });
  } catch (error) {
    console.error("Error processing coupon:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process coupon code",
      error: error.message,
    });
  }
};

const parseCustomDate = (dateStr) => {
  if (!dateStr) return null;

  const [datePart, timePart] = dateStr.split(",");
  const [day, month, year] = datePart.trim().split("/");

  return new Date(`${year}-${month}-${day} ${timePart?.trim() || ""}`);
};
// updated Tree Api
export const getUserWithReferrals = async (req, res) => {
  try {
    const { userId } = req.params;

    const mainUser = await User.findOne({ userId });
    if (!mainUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const referredUsers = await User.find({
      userId: { $in: mainUser.referredIds },
    });

    const allCourses = await CourseDetails.find({
      userId: { $in: mainUser.referredIds },
    });

    const now = new Date();

    // ✅ Cutoff date (30 April 2026)
    const cutoffDate = new Date("2026-04-30T23:59:59.999Z");

    const enrichedUsers = referredUsers.map((user) => {
      const userAllCourses = allCourses.filter((c) => c.userId === user.userId);

      // 🔥 MASTER / TEACHER logic (same)
      const userCourses = userAllCourses.filter(
        (c) =>
          c.packageName.toLowerCase().includes("master") ||
          c.packageName.toLowerCase().includes("teacher"),
      );

      let subscriptionMatch = null;

      // 🔥 Updated condition
      userAllCourses.forEach((course) => {
        const purchaseHistory = course.purchaseHistory || [];

        const firstPurchase = purchaseHistory[0]; // index 0

        const subscriptionPurchase = purchaseHistory
          .slice(1)
          .find((p) => p.packageName === "Monthly Subscription");
        if (
          firstPurchase &&
          subscriptionPurchase &&
          firstPurchase.packageName === "Learner Course"
        ) {
          const firstPurchaseDate = parseCustomDate(firstPurchase.date);

          // ✅ Only if first purchase (Learner) before cutoff
          if (firstPurchaseDate <= cutoffDate) {
            subscriptionMatch = course;
          }
        }
      });

      let courseStatus = "none";

      // ✅ Subscription logic (only valid cases)
      if (subscriptionMatch) {
        if (new Date(subscriptionMatch.validityEnd) > now) {
          courseStatus = "active";
        } else {
          courseStatus = "expired"; // ⭐ half
        }
      }

      // ✅ Master / Teacher fallback (unchanged)
      else if (userCourses.length > 0) {
        const latestCourse = userCourses.sort(
          (a, b) => new Date(b.validityEnd) - new Date(a.validityEnd),
        )[0];

        if (new Date(latestCourse.validityEnd) > now) {
          courseStatus = "active";
        } else {
          courseStatus = "expired";
        }
      }

      return {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        courseStatus,
        selfPoints: user.selfPoints,
        totalSelfPoints: user.totalSelfPoints,
        validityEnd: subscriptionMatch
          ? subscriptionMatch.validityEnd
          : userCourses[0]?.validityEnd || null,
      };
    });

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
          totalSelfPoints: mainUser.totalSelfPoints,
          status: mainUser.status,
        },
        referredUsers: enrichedUsers,
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

//Tree  Api
// export const getUserWithReferrals = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Find main user
//     const mainUser = await User.findOne({ userId });
//     if (!mainUser) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Find referred users using referredIds array
//     const referredUsers = await User.find({
//       userId: { $in: mainUser.referredIds },
//     });
//     const allCourses = await CourseDetails.find({
//       userId: { $in: mainUser.referredIds },
//     });

//     const now = new Date();
//     // ✅ Merge data
//     const enrichedUsers = referredUsers.map((user) => {
//       // 🔥 Get all MASTER courses of this user
//       const userCourses = allCourses.filter(
//         (c) =>
//           c.userId === user.userId &&
//         (
//           c.packageName.toLowerCase().includes("master") ||
//           c.packageName.toLowerCase().includes("teacher")
//         )
//       );

//       let courseStatus = "none";

//       if (userCourses.length > 0) {
//         // ✅ Get latest validityEnd
//         const latestCourse = userCourses.sort(
//           (a, b) => new Date(b.validityEnd) - new Date(a.validityEnd),
//         )[0];

//         if (new Date(latestCourse.validityEnd) > now) {
//           courseStatus = "active"; // ⭐ full
//         } else {
//           courseStatus = "expired"; // ⭐ half
//         }
//       }

//       return {
//         userId: user.userId,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         status: user.status,
//         courseStatus,
//         selfPoints: user.selfPoints,
//         totalSelfPoints: user.totalSelfPoints,
//         validityEnd: userCourses[0]?.validityEnd || null, // optional
//       };
//     });
//     res.status(200).json({
//       success: true,
//       message: "User and referred users fetched successfully",
//       data: {
//         mainUser: {
//           userId: mainUser.userId,
//           name: mainUser.name,
//           email: mainUser.email,
//           phone: mainUser.phone,
//           address: mainUser.address,
//           referralLink: mainUser.referralLink,
//           selfPoints: mainUser.selfPoints,
//           totalSelfPoints: mainUser.totalSelfPoints,
//           //referredPoints: mainUser.referredPoints,
//           //totalPoints: mainUser.totalPoints,
//           status: mainUser.status,
//         },
//         referredUsers: enrichedUsers,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching user and referrals:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch referral details",
//       error: error.message,
//     });
//   }
// };

// New API: Get Team Summary
// export const getTeamSummary = async (req, res) => {
//     try {
//         const { userId } = req.body;

//         if (!userId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "userId is required in request body",
//             });
//         }

//         // Step 1️⃣: Load all users once for optimization
//         const allUsers = await User.find({}, { userId: 1, name: 1, referredIds: 1, totalSelfPoints: 1 });
//         const userMap = new Map(allUsers.map(u => [u.userId, u]));

//         const rootUser = userMap.get(userId);
//         if (!rootUser) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found",
//             });
//         }

//         const visited = new Set();

//         // Step 2️⃣: Recursive function to calculate team stats
//         const calculateTeam = (id, level = 1) => {
//             if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
//             if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
//             visited.add(id);

//             const user = userMap.get(id);
//             if (!user || !user.referredIds?.length) return { totalPoints: 0, totalDownlineCount: 0 };

//             let totalPoints = 0;
//             let totalDownlineCount = 0;

//             for (const childId of user.referredIds) {
//                 const child = userMap.get(childId);
//                 if (!child) continue;

//                 totalPoints += child.totalSelfPoints || 0;
//                 totalDownlineCount += 1;

//                 const subTree = calculateTeam(childId, level + 1);
//                 totalPoints += subTree.totalPoints;
//                 totalDownlineCount += subTree.totalDownlineCount;
//             }

//             return { totalPoints, totalDownlineCount };
//         };

//         // Step 3️⃣: Compute team stats
//         const { totalPoints, totalDownlineCount } = calculateTeam(userId);

//         // Step 4️⃣: Count direct referrals
//         const directReferrals = rootUser.referredIds?.length || 0;

//         // ✅ Step 5️⃣: Send response
//         res.status(200).json({
//             success: true,
//             userId: rootUser.userId,
//             name: rootUser.name, // ✅ root user's name
//             totalPoints,
//             totalDownlineCount,
//             directReferrals,
//         });

//     } catch (error) {
//         console.error("Error in getTeamSummary:", error);
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: error.message,
//         });
//     }
// };

export const getTeamSummary = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required in request body",
      });
    }

    // Step 1️⃣: Load all users (optimized projection)
    const allUsers = await User.find(
      {},
      { userId: 1, name: 1, referredIds: 1, totalSelfPoints: 1 },
    );
    const userMap = new Map(allUsers.map((u) => [u.userId, u]));

    const rootUser = userMap.get(userId);
    if (!rootUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Step 2️⃣: Load all users who have Checkout records
    const checkoutUsers = await Checkout.find({}, { userId: 1 });
    const validUserIds = new Set(checkoutUsers.map((c) => c.userId));

    const visited = new Set();

    // Step 3️⃣: Recursive function to calculate team stats
    const calculateTeam = (id, level = 1) => {
      if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
      if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
      visited.add(id);

      const user = userMap.get(id);
      if (!user || !user.referredIds?.length) {
        return { totalPoints: 0, totalDownlineCount: 0 };
      }

      let totalPoints = 0;
      let totalDownlineCount = 0;

      for (const childId of user.referredIds) {
        const child = userMap.get(childId);
        if (!child) continue;

        // ✅ Count only users with Checkout for downline count
        if (validUserIds.has(childId)) {
          totalDownlineCount += 1;
        }

        // ✅ Always add points (regardless of checkout)
        totalPoints += child.totalSelfPoints || 0;

        const subTree = calculateTeam(childId, level + 1);
        totalPoints += subTree.totalPoints;
        totalDownlineCount += subTree.totalDownlineCount;
      }

      return { totalPoints, totalDownlineCount };
    };

    // Step 4️⃣: Compute totals
    const { totalPoints, totalDownlineCount } = calculateTeam(userId);

    // Step 5️⃣: Direct referrals → only those with checkout
    const directReferrals = (rootUser.referredIds || []).filter((id) =>
      validUserIds.has(id),
    ).length;

    // ✅ Step 6️⃣: Send response
    res.status(200).json({
      success: true,
      userId: rootUser.userId,
      name: rootUser.name,
      totalPoints,
      totalDownlineCount,
      directReferrals,
    });
  } catch (error) {
    console.error("❌ Error in getTeamSummary:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// New API: Get All Team Summaries
// export const getAllTeamSummaries = async (req, res) => {
//     try {
//         // Step 1️⃣: Load all users once for optimization
//         const allUsers = await User.find({}, { userId: 1, name: 1, referredIds: 1, totalSelfPoints: 1 });
//         const userMap = new Map(allUsers.map(u => [u.userId, u]));

//         // Step 2️⃣: Recursive function (same as before)
//         const calculateTeam = (id, level = 1, visited = new Set()) => {
//             if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
//             if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
//             visited.add(id);

//             const user = userMap.get(id);
//             if (!user || !user.referredIds?.length) return { totalPoints: 0, totalDownlineCount: 0 };

//             let totalPoints = 0;
//             let totalDownlineCount = 0;

//             for (const childId of user.referredIds) {
//                 const child = userMap.get(childId);
//                 if (!child) continue;

//                 totalPoints += child.totalSelfPoints || 0;
//                 totalDownlineCount += 1;

//                 const subTree = calculateTeam(childId, level + 1, visited);
//                 totalPoints += subTree.totalPoints;
//                 totalDownlineCount += subTree.totalDownlineCount;
//             }

//             return { totalPoints, totalDownlineCount };
//         };

//         // Step 3️⃣: Loop through every user
//         const results = [];
//         for (const user of allUsers) {
//             const { totalPoints, totalDownlineCount } = calculateTeam(user.userId);
//             const directReferrals = user.referredIds?.length || 0;

//             results.push({
//                 userId: user.userId,
//                 name: user.name,
//                 totalPoints,
//                 totalDownlineCount,
//                 directReferrals,
//             });
//         }

//         // Step 4️⃣: Send all results
//         res.status(200).json({
//             success: true,
//             count: results.length,
//             data: results,
//         });

//     } catch (error) {
//         console.error("Error in getAllTeamSummaries:", error);
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: error.message,
//         });
//     }
// };

export const getAllTeamSummaries = async (req, res) => {
  try {
    // Step 1️⃣: Load all users (optimized projection)
    const allUsers = await User.find(
      {},
      {
        userId: 1,
        name: 1,
        referredIds: 1,
        totalSelfPoints: 1,
      },
    );
    const userMap = new Map(allUsers.map((u) => [u.userId, u]));

    // Step 2️⃣: Load all users who have checkout records
    const checkoutUsers = await Checkout.find({}, { userId: 1 });
    const validUserIds = new Set(checkoutUsers.map((c) => c.userId));

    // Step 3️⃣: Recursive function with checkout filter
    const calculateTeam = (id, level = 1, visited = new Set()) => {
      if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
      if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
      visited.add(id);

      const user = userMap.get(id);
      if (!user || !user.referredIds?.length) {
        return { totalPoints: 0, totalDownlineCount: 0 };
      }

      let totalPoints = 0;
      let totalDownlineCount = 0;

      for (const childId of user.referredIds) {
        const child = userMap.get(childId);
        if (!child) continue;

        // ✅ Count downline only if user has checkout
        if (validUserIds.has(childId)) {
          totalDownlineCount += 1;
        }

        // ✅ Always add points
        totalPoints += child.totalSelfPoints || 0;

        const subTree = calculateTeam(childId, level + 1, visited);
        totalPoints += subTree.totalPoints;
        totalDownlineCount += subTree.totalDownlineCount;
      }

      return { totalPoints, totalDownlineCount };
    };

    // Step 4️⃣: Loop through every user
    const results = [];
    for (const user of allUsers) {
      const { totalPoints, totalDownlineCount } = calculateTeam(user.userId);
      // ✅ Direct referrals = only those who have checkout
      const directReferrals = (user.referredIds || []).filter((id) =>
        validUserIds.has(id),
      ).length;

      results.push({
        userId: user.userId,
        name: user.name,
        totalPoints,
        totalDownlineCount,
        directReferrals,
      });
    }

    // Step 5️⃣: Return response
    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("❌ Error in getAllTeamSummaries:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export const searchTreeUsers = async (req, res) => {
      try {
     console.log("SEARCH TREE API HIT");
      console.log(req.body);
    const { query } = req.body;

    if (!query?.trim()) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const users = await User.find({
      $or: [
        { userId: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } },
      ],
    })
      .select("userId name")
      .limit(20);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Search Tree Users Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};