import User from "../models/User.js";
import CourseDetails from "../models/CourseDetails.js";

// Supports IST strings such as:
// 13/10/2026, 2:45:13 pm
// 13/10/2026, 14:45:13
const parsePurchaseDate = (value) => {
  if (!value) return null;

  const match = String(value)
    .trim()
    .match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(am|pm))?$/i,
    );

  if (!match) return null;

  const [, d, m, y, h, min, sec, period] = match;

  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  let hours = Number(h);

  if (period) {
    const p = period.toLowerCase();

    if (hours < 1 || hours > 12) return null;

    if (p === "pm" && hours !== 12) hours += 12;
    if (p === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  const minutes = Number(min);
  const seconds = Number(sec);

  if (minutes > 59 || seconds > 59) return null;

  // Date is parsed as IST explicitly, regardless of server timezone.
  const date = new Date(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}+05:30`,
  );

  if (
    date.getFullYear() < 0 ||
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() < 1
  ) {
    return null;
  }

  // Validate the calendar date separately.
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const generateUniqueCouponCode = async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));

    const exists = await User.exists({ couponCode: code });

    if (!exists) return code;
  }

  throw new Error("Could not generate a unique coupon code");
};

// export const bulkGenerateReferralCoupons = async (req, res) => {
//   try {
//     // 13 October 00:00 IST through 31 October 23:59:59 IST
//     const startDate = new Date("2026-10-13T00:00:00+05:30");
//     const endDate = new Date("2026-11-01T00:00:00+05:30");

//     const referrers = await User.find({
//       referredIds: { $exists: true, $ne: [] },
//     })
//       .select("_id userId referredIds couponCode")
//       .lean();

//     const courses = await CourseDetails.find({
//       purchaseHistory: { $exists: true, $ne: [] },
//     })
//       .select("userId purchaseHistory")
//       .lean();

//     // Group CourseDetails by referred user's userId.
//     const coursesByUser = new Map();

//     for (const course of courses) {
//       const key = String(course.userId);

//       if (!coursesByUser.has(key)) {
//         coursesByUser.set(key, []);
//       }

//       coursesByUser.get(key).push(course);
//     }

//     const generatedCoupons = [];
//     const skippedExistingCoupons = [];
//     const errors = [];

//     for (const referrer of referrers) {
//       try {
//         // Do not overwrite existing coupons.
//         if (
//           referrer.couponCode != null &&
//           String(referrer.couponCode).trim() !== ""
//         ) {
//           skippedExistingCoupons.push({
//             userId: referrer.userId,
//             couponCode: referrer.couponCode,
//           });
//           continue;
//         }

//         let qualifyingPurchase = null;

//         for (const directUserId of referrer.referredIds || []) {
//           const userCourses = coursesByUser.get(String(directUserId)) || [];

//           // Find the most recent LAST array entry across this
//           // referred user's CourseDetails documents.
//           let latestPurchase = null;
//           let latestDate = null;

//           for (const course of userCourses) {
//             const history = course.purchaseHistory || [];
//             if (!history.length) continue;

//             const lastPurchase = history[history.length - 1];
//             const parsedDate = parsePurchaseDate(lastPurchase?.date);

//             if (!parsedDate) continue;

//             if (!latestDate || parsedDate > latestDate) {
//               latestDate = parsedDate;
//               latestPurchase = lastPurchase;
//             }
//           }

//           if (!latestPurchase || !latestDate) continue;
//           console.log("Referral purchase check:", {
//             referrerUserId: referrer.userId,
//             directUserId: String(directUserId),
//             latestStatus: latestPurchase.status,
//             latestAmount: latestPurchase.amount,
//             rawPurchaseDate: latestPurchase.date,
//             parsedPurchaseDate: latestDate?.toISOString(),
//             eligibleStatus: latestPurchase.status === "completed",
//             eligibleAmount: Number(latestPurchase.amount) > 1770,
//             eligibleDate: latestDate >= startDate && latestDate < endDate,
//           });
//           const eligible =
//             latestPurchase.status === "completed" &&
//             Number(latestPurchase.amount) > 1770 &&
//             latestDate >= startDate &&
//             latestDate < endDate;

//           if (eligible) {
//             qualifyingPurchase = {
//               referralUserId: String(directUserId),
//               amount: Number(latestPurchase.amount),
//               purchaseDate: latestPurchase.date,
//             };

//             break;
//           }
//         }

//         if (!qualifyingPurchase) continue;

//         let savedUser = null;

//         // Atomic save; retry if another request gets the same code.
//         for (let attempt = 0; attempt < 10; attempt++) {
//           const code = await generateUniqueCouponCode();

//           try {
//             savedUser = await User.findOneAndUpdate(
//               {
//                 _id: referrer._id,
//                 $or: [
//                   { couponCode: null },
//                   { couponCode: { $exists: false } },
//                   { couponCode: "" },
//                 ],
//               },
//               { $set: { couponCode: code } },
//               { new: true },
//             )
//               .select("userId couponCode")
//               .lean();

//             break;
//           } catch (error) {
//             if (error.code === 11000) continue;
//             throw error;
//           }
//         }

//         if (savedUser) {
//           generatedCoupons.push({
//             userId: savedUser.userId,
//             couponCode: savedUser.couponCode,
//             qualifyingReferralUserId: qualifyingPurchase.referralUserId,
//             purchaseAmount: qualifyingPurchase.amount,
//             purchaseDate: qualifyingPurchase.purchaseDate,
//           });
//         } else {
//           const currentUser = await User.findById(referrer._id)
//             .select("userId couponCode")
//             .lean();

//           if (currentUser?.couponCode) {
//             skippedExistingCoupons.push({
//               userId: currentUser.userId,
//               couponCode: currentUser.couponCode,
//             });
//           } else {
//             errors.push({
//               userId: referrer.userId,
//               message: "Could not save coupon code",
//             });
//           }
//         }
//       } catch (error) {
//         console.error("Coupon error for referrer:", referrer.userId, error);

//         errors.push({
//           userId: referrer.userId,
//           message: error.message,
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Bulk coupon processing completed",
//       summary: {
//         referrersChecked: referrers.length,
//         couponsGenerated: generatedCoupons.length,
//         existingCouponsSkipped: skippedExistingCoupons.length,
//         errors: errors.length,
//       },
//       generatedCoupons,
//       skippedExistingCoupons,
//       errors,
//     });
//   } catch (error) {
//     console.error("Bulk coupon API error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Bulk coupon processing failed",
//       error: error.message,
//     });
//   }
// };





// Purchase date string-ke IST theke UTC Date-e convert kore.
// Supports:
// 1/10/2026, 4:13:28 pm
// 13/10/2026, 2:45:13 pm
// 13/10/2026, 14:45:13



export const bulkGenerateReferralCoupons = async (req, res) => {
  try {
    // 1 October 2026 00:00 IST, inclusive
    const startDate = new Date(
      "2026-10-13T00:00:00+05:30"
    );

    // 1 November 2026 00:00 IST, exclusive
    const endDate = new Date(
      "2026-11-01T00:00:00+05:30"
    );

    const MIN_PURCHASE_AMOUNT = 2950;

    // Step 1: Find referrers who have direct referrals.
    // Referrer's own purchase history is NOT checked.
    const referrers = await User.find({
      referredIds: { $exists: true, $ne: [] },
    })
      .select("_id userId referredIds couponCode")
      .lean();

    // Collect all direct referral user IDs.
    const directUserIds = [
      ...new Set(
        referrers.flatMap((referrer) =>
          (referrer.referredIds || [])
            .map((id) => String(id).trim())
            .filter(Boolean)
        )
      ),
    ];

    // Step 2: Fetch CourseDetails only for direct referrals.
    const courses = directUserIds.length
      ? await CourseDetails.find({
          userId: { $in: directUserIds },
          "purchaseHistory.0": { $exists: true },
        })
          .select("userId purchaseHistory")
          .lean()
      : [];

    // Group CourseDetails by the referred user's userId.
    const coursesByUser = new Map();

    for (const course of courses) {
      const key = String(course.userId).trim();

      if (!coursesByUser.has(key)) {
        coursesByUser.set(key, []);
      }

      coursesByUser.get(key).push(course);
    }

    const generatedCoupons = [];
    const skippedExistingCoupons = [];
    const noEligiblePurchase = [];
    const errors = [];

    // Step 3: Check each referrer.
    for (const referrer of referrers) {
      try {
        // Never overwrite an existing coupon.
        if (
          referrer.couponCode != null &&
          String(referrer.couponCode).trim() !== ""
        ) {
          skippedExistingCoupons.push({
            userId: referrer.userId,
            couponCode: referrer.couponCode,
            reason: "Coupon already exists",
          });

          continue;
        }

        let qualifyingPurchase = null;

        // Step 4: Check every direct referral.
        for (const directUserId of referrer.referredIds || []) {
          const referralId = String(directUserId).trim();

          const userCourses =
            coursesByUser.get(referralId) || [];

          // Check ALL purchase-history entries across ALL
          // CourseDetails documents belonging to this referral.
          for (const course of userCourses) {
            for (const purchase of course.purchaseHistory || []) {
              const purchaseDate = parsePurchaseDate(
                purchase?.date
              );

              if (!purchaseDate) {
                continue;
              }

              const amount = Number(purchase.amount);

              const eligible =
                purchase.status === "completed" &&
                Number.isFinite(amount) &&
                amount > MIN_PURCHASE_AMOUNT &&
                purchaseDate >= startDate &&
                purchaseDate < endDate;

              console.log("Referral purchase check:", {
                referrerUserId: referrer.userId,
                directUserId: referralId,
                amount,
                status: purchase.status,
                purchaseDate: purchase.date,
                parsedDate: purchaseDate.toISOString(),
                eligible,
              });

              if (eligible) {
                qualifyingPurchase = {
                  referralUserId: referralId,
                  amount,
                  purchaseDate: purchase.date,
                };

                // One qualifying purchase is enough.
                break;
              }
            }

            if (qualifyingPurchase) break;
          }

          if (qualifyingPurchase) break;
        }

        // No qualifying purchase among direct referrals.
        if (!qualifyingPurchase) {
          noEligiblePurchase.push({
            userId: referrer.userId,
            reason: "No qualifying direct referral purchase",
          });

          continue;
        }

        // Step 5: Generate and save one coupon atomically.
        let savedUser = null;

        for (let attempt = 0; attempt < 10; attempt++) {
          const code = await generateUniqueCouponCode();

          try {
            savedUser = await User.findOneAndUpdate(
              {
                _id: referrer._id,
                $or: [
                  { couponCode: null },
                  { couponCode: { $exists: false } },
                  { couponCode: "" },
                ],
              },
              {
                $set: { couponCode: code },
              },
              {
                new: true,
                runValidators: true,
              }
            )
              .select("userId couponCode")
              .lean();

            if (savedUser) break;

            // Another request may have already generated a coupon.
            break;
          } catch (error) {
            // Retry if another request claimed the same unique code.
            if (error.code === 11000) {
              continue;
            }

            throw error;
          }
        }

        if (savedUser) {
          generatedCoupons.push({
            userId: savedUser.userId,
            couponCode: savedUser.couponCode,
            qualifyingReferralUserId:
              qualifyingPurchase.referralUserId,
            purchaseAmount: qualifyingPurchase.amount,
            purchaseDate: qualifyingPurchase.purchaseDate,
          });
        } else {
          // Determine whether another request saved a coupon.
          const currentUser = await User.findById(referrer._id)
            .select("userId couponCode")
            .lean();

          if (
            currentUser?.couponCode != null &&
            String(currentUser.couponCode).trim() !== ""
          ) {
            skippedExistingCoupons.push({
              userId: currentUser.userId,
              couponCode: currentUser.couponCode,
              reason: "Coupon already exists",
            });
          } else {
            errors.push({
              userId: referrer.userId,
              message: "Could not save coupon after retries",
            });
          }
        }
      } catch (error) {
        console.error(
          "Coupon generation error:",
          referrer.userId,
          error
        );

        errors.push({
          userId: referrer.userId,
          message: error.message,
        });
      }
    }

    const summary = {
      referrersChecked: referrers.length,
      directReferralUsersFound: directUserIds.length,
      couponsGenerated: generatedCoupons.length,
      existingCouponsSkipped: skippedExistingCoupons.length,
      noEligiblePurchase: noEligiblePurchase.length,
      errors: errors.length,
    };

    console.log("Bulk coupon summary:", summary);

    return res.status(200).json({
      success: true,
      message: "Bulk coupon processing completed",
      criteria: {
        startDate: "01/10/2026 00:00 IST",
        endDate: "31/10/2026 23:59:59 IST",
        minimumPurchaseAmountExclusive: MIN_PURCHASE_AMOUNT,
        requiredStatus: "completed",
        purchaseRule:
          "Any purchase within the date range can qualify",
        referralRule:
          "Only direct referrals in referredIds are checked",
        referrerPurchaseHistoryChecked: false,
        maximumCouponsPerReferrer: 1,
      },
      summary,
      generatedCoupons,
      skippedExistingCoupons,
      noEligiblePurchase,
      errors,
    });
  } catch (error) {
    console.error("Bulk coupon API error:", error);

    return res.status(500).json({
      success: false,
      message: "Bulk coupon processing failed",
      error: error.message,
    });
  }
};


// Existing parsePurchaseDate() helper-ta reuse koro.

export const getGeneratedCoupons = async (req, res) => {
  try {
    const startDate = new Date("2026-10-13T00:00:00+05:30");
    const endDate = new Date("2026-11-01T00:00:00+05:30");
    const MIN_AMOUNT = 2950;

    // Only users who already have coupon codes.
    const referrers = await User.find({
      couponCode: { $type: "string", $nin: ["", " "] },
    })
      .select("name userId couponCode referredIds")
      .lean();

    // Collect their direct referral user IDs.
    const directIds = [
      ...new Set(
        referrers.flatMap((user) =>
          (user.referredIds || []).map((id) => String(id).trim())
        )
      ),
    ];

    // Fetch purchase histories for direct referrals only.
    const courses = directIds.length
      ? await CourseDetails.find({
          userId: { $in: directIds },
          "purchaseHistory.0": { $exists: true },
        })
          .select("userId purchaseHistory")
          .lean()
      : [];

    const coursesByUser = new Map();

    for (const course of courses) {
      const id = String(course.userId).trim();

      if (!coursesByUser.has(id)) {
        coursesByUser.set(id, []);
      }

      coursesByUser.get(id).push(course);
    }

    const coupons = [];

    for (const referrer of referrers) {
      let qualifyingReferral = null;

      for (const directId of referrer.referredIds || []) {
        const referralId = String(directId).trim();
        const referralCourses = coursesByUser.get(referralId) || [];

        for (const course of referralCourses) {
          for (const purchase of course.purchaseHistory || []) {
            const purchaseDate = parsePurchaseDate(purchase.date);

            if (!purchaseDate) continue;

            const eligible =
              purchase.status === "completed" &&
              Number(purchase.amount) > MIN_AMOUNT &&
              purchaseDate >= startDate &&
              purchaseDate < endDate;

            if (eligible) {
              qualifyingReferral = referralId;
              break;
            }
          }

          if (qualifyingReferral) break;
        }

        if (qualifyingReferral) break;
      }

      coupons.push({
        name: referrer.name,
        userId: referrer.userId,
        couponCode: referrer.couponCode,
        referredUserId: qualifyingReferral,
      });
    }

    return res.status(200).json({
      success: true,
      total: coupons.length,
      coupons,
    });
  } catch (error) {
    console.error("Get generated coupons error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

