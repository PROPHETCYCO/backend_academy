import mongoose from "mongoose";

// ✅ Helper function to store IST date/time
function getISTDate() {
    const now = new Date();
    const utcOffset = now.getTime() + 5.5 * 60 * 60 * 1000;
    return new Date(utcOffset);
}

const payoutSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        totalPoints: {
            type: Number,
            default: 0,
        },

        referredPoints: {
            type: Number,
            default: 0,
        },

        directReferredPoints: {
            type: Number,
            default: 0,
        },

        payouts: [
            {
                _id: {
                    type: mongoose.Schema.Types.ObjectId,
                    default: () => new mongoose.Types.ObjectId(),
                },

                amount: {
                    type: Number,
                    required: true,
                },

                payoutAmount: {
                    type: Number,
                    required: true,
                },

                // ✅ Store IST date & time as readable string
                date: {
                    type: String,
                    default: () =>
                        new Date().toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                        }),
                },

                status: {
                    type: String,
                    enum: ["pending", "completed", "failed"],
                    default: "pending",
                },
            },
        ],
    },
    { timestamps: true }
);

const Payout = mongoose.model("Payout", payoutSchema);
export default Payout;