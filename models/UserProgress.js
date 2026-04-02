import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  watchedVideos: [
    {
      videoId: Number,
      watchedAt: { type: Date, default: Date.now },
    },
  ],

  quizPassed: { type: Boolean, default: false },
  certificateGenerated: { type: Boolean, default: false },
});

const UserProgress = mongoose.model("UserProgress", userProgressSchema);
export default UserProgress;