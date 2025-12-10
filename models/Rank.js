import mongoose from "mongoose";

// Helper function for IST time
function getISTDate() {
    const now = new Date();
    const utcOffset = now.getTime() + 5.5 * 60 * 60 * 1000;
    return new Date(utcOffset);
}

const rewardSchema = new mongoose.Schema({
    rankName: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending / approved / rejected
    achievedAt: {
        type: Date,
        default: getISTDate
    }
});

const rankSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true },
        name: { type: String, required: true },

        // NEW FIELDS
        totalTeam: { type: Number, default: 0 },
        directTeam: { type: Number, default: 0 },
        points: { type: Number, default: 0 },

        rewards: [rewardSchema],
    },
    { timestamps: true }
);

export default mongoose.model("Rank", rankSchema);