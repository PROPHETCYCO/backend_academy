import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io } from "../index.js";


///start conversation


export const startConversation = async (req, res) => {
  try {
    const { studentId } = req.body;

    const conversation = await Conversation.findOneAndUpdate(
      { studentId },
      {
        $setOnInsert: {
          studentId,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Start Conversation Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
/////send message
export const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      senderId,
      senderType,
      message,
    } = req.body;

    const newMessage = await Message.create({
      conversationId,
      senderId,
      senderType,
      message,
    });

    const conversation = await Conversation.findById(conversationId);

    conversation.lastMessage = message;

    if (senderType === "student") {
  conversation.unreadByAdmin += 1;
} else {
  conversation.unreadByStudent += 1;

  // admin is already viewing the conversation
  conversation.unreadByAdmin = 0;
}

    await conversation.save();
   io.to("admin-room").emit("newMessage", newMessage);

io.to(senderId).emit("newMessage", newMessage);
    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Send Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
///get messages
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversationId,
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Get Messages Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
///get conversations
export const getConversations = async (req, res) => {
    try {

        const conversations = await Conversation.find().sort({
            updatedAt: -1,
        });

        const result = await Promise.all(
            conversations.map(async (conversation) => {

                const user = await User.findOne({
                    userId: conversation.studentId,
                }).select("name userId email phone");

                return {
                    ...conversation.toObject(),
                    student: user,
                };
            })
        );

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });

    }
};

export const markSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { senderType } = req.body;

    await Message.updateMany(
      {
        conversationId,
        senderType: senderType === "student" ? "admin" : "student",
        seen: false,
      },
      {
        $set: {
          seen: true,
        },
      }
    );

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (senderType === "student") {
      conversation.unreadByStudent = 0;
    } else {
      conversation.unreadByAdmin = 0;
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: "Messages marked as seen",
    });
  } catch (error) {
    console.error("Mark Seen Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
export const getUnreadCount = async (req, res) => {
  try {
    const { studentId } = req.params;

    const conversation = await Conversation.findOne({ studentId });

    return res.status(200).json({
      success: true,
      unreadCount: conversation ? conversation.unreadByStudent : 0,
    });
  } catch (error) {
    console.error("Get Unread Count Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};