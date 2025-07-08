import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Số phòng là bắt buộc'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{3,4}$/.test(v);
      },
      message: props => `${props.value} không phải là số phòng hợp lệ! Số phòng phải có 3-4 chữ số`
    }
  },
  type: {
    type: String,
    required: [true, 'Loại phòng là bắt buộc'],
    enum: {
      values: ["Standard", "Deluxe", "Suite", "Presidential"],
      message: '{VALUE} không phải là loại phòng hợp lệ'
    }
  },
  price: {
    type: Number,
    required: [true, 'Giá phòng là bắt buộc'],
    min: [0, 'Giá phòng không thể âm'],
    validate: {
      validator: function(v) {
        return !isNaN(v) && Number.isFinite(v);
      },
      message: props => `${props.value} không phải là giá hợp lệ!`
    }
  },
  capacity: {
    type: Number,
    required: [true, 'Sức chứa là bắt buộc'],
    min: [1, 'Sức chứa tối thiểu là 1 người'],
    max: [10, 'Sức chứa tối đa là 10 người'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && !isNaN(v);
      },
      message: props => `${props.value} phải là số nguyên!`
    }
  },
  amenities: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.every(item => typeof item === 'string' && item.trim().length > 0);
      },
      message: 'Các tiện nghi không được để trống'
    }
  },
  images: {
    type: [String],
    validate: {
      validator: function(v) {
        if (!Array.isArray(v)) return false;
        return v.every(img => typeof img === 'string' && img.trim().length > 0);
      },
      message: 'Đường dẫn hình ảnh không hợp lệ'
    },
    set: function(v) {
      if (Array.isArray(v)) {
        // Lọc ra các đường dẫn hợp lệ và loại bỏ duplicate
        return [...new Set(v.filter(img => img && typeof img === 'string' && img.trim().length > 0))];
      }
      return v;
    }
  },
  status: {
    type: String,
    enum: {
      values: ["available", "occupied", "maintenance", "cleaning"],
      message: '{VALUE} không phải là trạng thái hợp lệ'
    },
    default: "available"
  },
  description: {
    type: String,
    required: [true, 'Mô tả phòng là bắt buộc'],
    trim: true,
    minlength: [10, 'Mô tả phải có ít nhất 10 ký tự']
  },
  floor: {
    type: Number,
    required: [true, 'Số tầng là bắt buộc'],
    min: [1, 'Số tầng tối thiểu là 1'],
    max: [20, 'Số tầng tối đa là 20'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && !isNaN(v);
      },
      message: props => `${props.value} phải là số nguyên!`
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Add virtual field for bookings
RoomSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'room'
});

// Ensure virtuals are included in JSON and object conversions
RoomSchema.set('toObject', { virtuals: true });
RoomSchema.set('toJSON', { virtuals: true });

// Add method to check room availability
RoomSchema.methods.isAvailable = async function(checkIn, checkOut) {
  const booking = await mongoose.model('Booking').findOne({
    room: this._id,
    status: { $in: ['pending', 'confirmed', 'checked-in'] },
    $or: [
      // Check if there is any overlap with existing bookings
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn }
      }
    ]
  });
  
  return !booking; // Return true if no overlapping booking found
};

export default mongoose.model("Room", RoomSchema);
