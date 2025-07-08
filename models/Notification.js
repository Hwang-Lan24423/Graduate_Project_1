import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["booking", "service", "payment", "system", "review", "other"],
    default: "system",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  relatedTo: {
    model: {
      type: String,
      enum: ["Booking", "ServiceRequest", "Payment", "User", "Review"],
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
