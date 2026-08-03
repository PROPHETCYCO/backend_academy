import mongoose from "mongoose";
const conversationSchema = new mongoose.Schema(
{
    studentId: {
  type: String,
  required: true,
  unique: true,

},

    

    lastMessage: {
      type: String,
      default: "",
    },

    unreadByAdmin: {
      type: Number,
      default: 0,
    },

    unreadByStudent: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);


const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;