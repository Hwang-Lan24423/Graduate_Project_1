import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    maxLength: 500,
  },
  images: [String],
  isApproved: {
    type: Boolean,
    default: false,
  },
  adminResponse: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ReviewSchema.post("save", async function (doc) {
  try {
    const Review = this.constructor;
    const Room = mongoose.model("Room");

    // Tính rating trung bình cho phòng
    const reviews = await Review.find({ room: doc.room });
    const room = await Room.findById(doc.room);

    if (room && reviews.length > 0) {
      const avg = reviews.reduce((acc, item) => acc + item.rating, 0) / reviews.length;
      room.rating = {
        average: avg,
        count: reviews.length,
      };
      await room.save();
    }
  } catch (err) {
    console.error("Error updating room rating:", err);
  }
});

const Review = mongoose.model("Review", ReviewSchema);
export default Review;
