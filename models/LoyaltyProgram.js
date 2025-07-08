import mongoose from "mongoose";

const LoyaltyProgramSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  pointsPerDollar: {
    type: Number,
    default: 1,
  },
  tiers: [
    {
      name: {
        type: String,
        required: true,
      },
      minimumPoints: {
        type: Number,
        required: true,
      },
      benefits: {
        type: [String],
        default: [],
      },
      discountPercentage: {
        type: Number,
        default: 0,
      },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

LoyaltyProgramSchema.methods.calculateUserTier = function (points) {
  let currentTier = null;
  for (const tier of this.tiers) {
    if (points >= tier.minimumPoints) {
      currentTier = tier;
    } else {
      break;
    }
  }
  return currentTier;
};

LoyaltyProgramSchema.methods.getNextTier = function (currentPoints) {
  return this.tiers.find((tier) => tier.minimumPoints > currentPoints);
};

const LoyaltyProgram = mongoose.model("LoyaltyProgram", LoyaltyProgramSchema);

export default LoyaltyProgram;
