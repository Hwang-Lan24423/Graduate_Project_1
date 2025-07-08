import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    enum: ["room-service", "cleaning", "food", "spa", "transport", "other"],
    required: true,
  },
  available: {
    type: Boolean,
    default: true,
  },
  image: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Service = mongoose.model("Service", ServiceSchema);

export default Service;
