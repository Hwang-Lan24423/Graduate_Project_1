import mongoose from "mongoose";

const ServiceRequestSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "cancelled"],
    default: "pending",
  },
  requestDate: {
    type: Date,
    default: Date.now,
  },
  completionDate: {
    type: Date,
  },
  notes: {
    type: String,
  },
  assignedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

ServiceRequestSchema.pre("save", async function (next) {
  if (this.status === "completed" && this.isModified("status")) {
    const service = await mongoose.model("Service").findById(this.service);
    const booking = await mongoose.model("Booking").findById(this.booking);

    // Add service charge to booking total
    booking.totalPrice += service.price;
    await booking.save();

    // Create notification
    const notification = new mongoose.model("Notification")({
      recipient: booking.customer,
      title: "Service Completed",
      message: `Your request for ${service.name} has been completed.`,
      type: "service",
      relatedTo: {
        model: "ServiceRequest",
        id: this._id,
      },
    });
    await notification.save();
  }
  next();
});

const ServiceRequest = mongoose.model("ServiceRequest", ServiceRequestSchema);

export default ServiceRequest;
