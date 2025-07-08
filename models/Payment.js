import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["credit-card", "debit-card", "cash", "bank-transfer", "paypal"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  transactionId: {
    type: String,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  notes: {
    type: String,
  },
});

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
