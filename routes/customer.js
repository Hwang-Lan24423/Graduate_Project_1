import express from "express";
import { isLoggedIn, isCustomer } from "../middleware/auth.js";
import Room from "../models/Room.js";
import Booking from "../models/booking.js";
import Service from "../models/Service.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Review from "../models/Review.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import LoyaltyProgram from "../models/LoyaltyProgram.js";
import Payment from "../models/Payment.js";
import { processPayment, validatePayment } from "../utils/payment.js";

const router = express.Router();

// Customer dashboard
router.get("/dashboard", isLoggedIn, isCustomer, async (req, res) => {
  try {
    // Get active bookings
    const activeBookings = await Booking.find({
      customer: req.user._id,
      status: { $in: ["confirmed", "checked-in"] },
    })
      .populate("room")
      .sort({ checkInDate: 1 });

    // Get unread notifications
    const notifications = await Notification.find({
      recipient: req.user._id,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get loyalty info
    const loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true });

    // Determine user's loyalty tier
    let userTier = null;
    if (loyaltyProgram) {
      for (const tier of loyaltyProgram.tiers) {
        if (req.user.loyaltyPoints >= tier.minimumPoints) {
          userTier = tier;
        } else {
          break;
        }
      }
    }

    res.render("customer/dashboard", {
      title: "Customer Dashboard",
      activeBookings,
      notifications,
      loyaltyProgram,
      userTier,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/");
  }
});

// Profile page
router.get("/profile", isLoggedIn, isCustomer, (req, res) => {
  res.render("customer/profile", { title: "My Profile" });
});

// Update profile
router.post("/profile", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      name,
      phone,
      address,
    });

    req.flash("success", "Profile updated successfully");
    res.redirect("/customer/profile");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update profile");
    res.redirect("/customer/profile");
  }
});

// Bookings list
router.get("/bookings", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate("room")
      .sort({ createdAt: -1 });

    res.render("customer/bookings", {
      title: "My Bookings",
      bookings,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load bookings");
    res.redirect("/customer/dashboard");
  }
});

// Booking details
router.get("/bookings/:id", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("room")
      .populate("customer");

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/customer/bookings");
    }

    // Check if booking belongs to current user
    if (booking.customer._id.toString() !== req.user._id.toString()) {
      req.flash("error", "Unauthorized");
      return res.redirect("/customer/bookings");
    }

    // Get service requests for this booking
    const serviceRequests = await ServiceRequest.find({ booking: booking._id })
      .populate("service")
      .sort({ requestDate: -1 });

    // Get available services
    const availableServices = await Service.find({ available: true });

    // Get reviews for this booking
    const reviews = await Review.find({ booking: booking._id });

    res.render("customer/booking-details", {
      title: "Booking Details",
      booking,
      serviceRequests,
      availableServices,
      reviews,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load booking details");
    res.redirect("/customer/bookings");
  }
});

// Cancel booking
router.post(
  "/bookings/:id/cancel",
  isLoggedIn,
  isCustomer,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);

      if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/customer/bookings");
      }

      // Check if booking belongs to current user
      if (booking.customer.toString() !== req.user._id.toString()) {
        req.flash("error", "Unauthorized");
        return res.redirect("/customer/bookings");
      }

      // Check if booking can be cancelled
      if (booking.status === "checked-in" || booking.status === "checked-out") {
        req.flash(
          "error",
          "Cannot cancel a booking that has already started or completed"
        );
        return res.redirect(`/customer/bookings/${booking._id}`);
      }

      // Update booking status
      booking.status = "cancelled";
      booking.updatedBy = req.user._id;
      await booking.save();

      // Update room status
      await Room.findByIdAndUpdate(booking.room, { status: "available" });

      // Create notification
      const notification = new Notification({
        recipient: req.user._id,
        title: "Booking Cancelled",
        message: `Your booking for ${booking.checkInDate.toLocaleDateString()} has been cancelled.`,
        type: "booking",
        relatedTo: {
          model: "Booking",
          id: booking._id,
        },
      });

      await notification.save();

      req.flash("success", "Booking cancelled successfully");
      res.redirect("/customer/bookings");
    } catch (err) {
      console.error(err);
      req.flash("error", "Failed to cancel booking");
      res.redirect("/customer/bookings");
    }
  }
);

// New booking page
router.get("/book", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const rooms = await Room.find({ status: "available" });

    res.render("customer/book", {
      title: "Book a Room",
      rooms,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load available rooms");
    res.redirect("/customer/dashboard");
  }
});

// Create new booking
router.post("/book", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const { roomId, checkInDate, checkOutDate, specialRequests, guests } =
      req.body;

    // Validate dates and room availability
    const room = await Room.findById(roomId);
    const isAvailable = await room.isAvailable(
      new Date(checkInDate),
      new Date(checkOutDate)
    );

    if (!isAvailable) {
      req.flash("error", "Room is not available for selected dates");
      return res.redirect("/customer/book");
    }

    // Calculate price with loyalty discount
    const loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true });
    let discount = 0;
    if (loyaltyProgram) {
      const userTier = loyaltyProgram.tiers.find(
        (tier) => req.user.loyaltyPoints >= tier.minimumPoints
      );
      if (userTier) {
        discount = userTier.discountPercentage / 100;
      }
    }

    const days = Math.ceil(
      (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)
    );
    const basePrice = room.price * days;
    const totalPrice = basePrice * (1 - discount);

    const booking = new Booking({
      customer: req.user._id,
      room: roomId,
      checkInDate,
      checkOutDate,
      guests,
      totalPrice,
      specialRequests,
      discountApplied: discount > 0 ? discount * 100 : 0,
    });

    await booking.save();

    // Create notification
    const notification = new Notification({
      recipient: req.user._id,
      title: "Booking Confirmed",
      message: `Your booking for ${room.type} room has been confirmed.`,
      type: "booking",
      relatedTo: {
        model: "Booking",
        id: booking._id,
      },
    });
    await notification.save();

    req.flash("success", "Booking created successfully");
    res.redirect(`/customer/bookings/${booking._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to create booking");
    res.redirect("/customer/book");
  }
});

// Request service
router.post("/service-request", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const { bookingId, serviceId, notes } = req.body;

    // Validate booking
    const booking = await Booking.findById(bookingId);

    if (!booking || booking.customer.toString() !== req.user._id.toString()) {
      req.flash("error", "Invalid booking");
      return res.redirect("/customer/bookings");
    }

    // Validate service
    const service = await Service.findById(serviceId);

    if (!service || !service.available) {
      req.flash("error", "Service not available");
      return res.redirect(`/customer/bookings/${bookingId}`);
    }

    // Create service request
    const serviceRequest = new ServiceRequest({
      customer: req.user._id,
      booking: bookingId,
      service: serviceId,
      notes,
    });

    await serviceRequest.save();

    // Get all staff users
    const staffUsers = await User.find({ role: "staff" });

    // Create notification for each staff member
    const staffNotifications = staffUsers.map(staff => ({
      recipient: staff._id,
      title: "New Service Request",
      message: `A new ${service.name} service has been requested by ${req.user.name}`,
      type: "service",
      relatedTo: {
        model: "ServiceRequest",
        id: serviceRequest._id,
      }
    }));

    // Insert all notifications at once
    await Notification.insertMany(staffNotifications);

    req.flash("success", "Service request submitted successfully");
    res.redirect(`/customer/bookings/${bookingId}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to submit service request");
    res.redirect("/customer/bookings");
  }
});

// Submit review
router.post("/review", isLoggedIn, isCustomer, async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  
  try {
    const booking = await Booking.findById(bookingId).populate("room");

    if (!booking || booking.customer.toString() !== req.user._id.toString()) {
      req.flash("error", "Invalid booking");
      return res.redirect("/customer/bookings");
    }

    // Check if booking is completed
    if (booking.status !== "checked-out") {
      req.flash("error", "Bạn chỉ có thể đánh giá sau khi hoàn thành booking");
      return res.redirect(`/customer/bookings/${bookingId}`);
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      booking: bookingId,
      customer: req.user._id,
    });

    if (existingReview) {
      req.flash("error", "Bạn đã đánh giá booking này rồi");
      return res.redirect(`/customer/bookings/${bookingId}`);
    }

    // Create review
    const review = new Review({
      booking: bookingId,
      customer: req.user._id,
      room: booking.room._id,
      rating: parseInt(rating),
      comment,
      isApproved: false
    });

    await review.save();

    // Tìm admin user để gửi thông báo
    const admin = await User.findOne({ role: 'admin' });

    if (admin) {
      // Tạo thông báo cho admin
      const notification = new Notification({
        recipient: admin._id, // Set recipient là admin
        title: "Có đánh giá mới",
        message: `Khách hàng ${req.user.name} vừa đánh giá phòng ${booking.room.roomNumber}`,
        type: "review",
        relatedTo: {
          model: "Review",
          id: review._id
        }
      });

      await notification.save();
    }

    req.flash("success", "Gửi đánh giá thành công. Đánh giá của bạn sẽ được hiển thị sau khi được phê duyệt");
    return res.redirect(`/customer/bookings/${bookingId}`);

  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể gửi đánh giá");
    return res.redirect("/customer/bookings"); 
  }
});

// Notifications page
router.get("/notifications", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
    }).sort({ createdAt: -1 });

    // Mark all as read
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.render("customer/notifications", {
      title: "My Notifications",
      notifications,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load notifications");
    res.redirect("/customer/dashboard");
  }
});

// Mark all notifications as read
router.post("/notifications/mark-all-read", isLoggedIn, isCustomer, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id },
      { isRead: true }
    );

    req.flash("success", "Đã đánh dấu tất cả thông báo là đã đọc");
    res.redirect("/customer/notifications");
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể cập nhật trạng thái thông báo");
    res.redirect("/customer/notifications");
  }
});

// Delete all notifications
router.post("/notifications/delete-all", isLoggedIn, isCustomer, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });

    req.flash("success", "Đã xóa tất cả thông báo");
    res.redirect("/customer/notifications");
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể xóa thông báo");
    res.redirect("/customer/notifications");
  }
});

// Loyalty program page
router.get("/loyalty", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true });

    if (!loyaltyProgram) {
      req.flash("error", "Loyalty program not available");
      return res.redirect("/customer/dashboard");
    }

    // Determine user's tier
    let userTier = null;
    let nextTier = null;

    for (let i = 0; i < loyaltyProgram.tiers.length; i++) {
      const tier = loyaltyProgram.tiers[i];

      if (req.user.loyaltyPoints >= tier.minimumPoints) {
        userTier = tier;

        // Check if there's a next tier
        if (i < loyaltyProgram.tiers.length - 1) {
          nextTier = loyaltyProgram.tiers[i + 1];
        }
      } else {
        if (!userTier) {
          nextTier = tier;
        }
        break;
      }
    }

    res.render("customer/loyalty", {
      title: "Loyalty Program",
      loyaltyProgram,
      userTier,
      nextTier,
      pointsToNextTier: nextTier
        ? nextTier.minimumPoints - req.user.loyaltyPoints
        : 0,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load loyalty program");
    res.redirect("/customer/dashboard");
  }
});

// Process payment
router.post("/bookings/:id/payment", isLoggedIn, isCustomer, async (req, res) => {
  try {
    const { paymentMethod, amount } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('customer');

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/customer/bookings");
    }

    // Validate booking belongs to customer
    if (booking.customer._id.toString() !== req.user._id.toString()) {
      req.flash("error", "Unauthorized");
      return res.redirect("/customer/bookings");
    }

    // Validate payment information
    validatePayment(paymentMethod, amount);

    // Process payment through payment gateway
    const paymentResult = await processPayment(paymentMethod, amount, booking._id);

    // Create payment record
    const payment = new Payment({
      booking: booking._id,
      amount: Number.parseFloat(amount),
      paymentMethod,
      status: "completed",
      transactionId: paymentResult.transactionId
    });

    await payment.save();

    // Update booking payment status
    const totalPaid = await Payment.aggregate([
      { $match: { booking: booking._id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const paidAmount = totalPaid.length > 0 ? totalPaid[0].total : 0;

    if (paidAmount >= booking.totalPrice) {
      booking.paymentStatus = "paid";
      await booking.save();
    }

    // Create notification for staff
    const staffUsers = await User.find({ role: "staff" });
    const staffNotifications = staffUsers.map(staff => ({
      recipient: staff._id,
      title: "Payment Completed",
      message: `Payment of $${amount} completed for booking #${booking._id} via ${paymentMethod}`,
      type: "payment",
      relatedTo: {
        model: "Payment",
        id: payment._id
      }
    }));

    await Notification.insertMany(staffNotifications);

    // Create notification for customer
    const customerNotification = new Notification({
      recipient: req.user._id,
      title: "Payment Successful",
      message: `Your payment of $${amount} has been processed successfully.`,
      type: "payment",
      relatedTo: {
        model: "Payment",
        id: payment._id
      }
    });

    await customerNotification.save();

    // Render payment success page
    res.render("customer/payment-success", {
      payment: {
        ...payment.toObject(),
        booking
      }
    });

  } catch (err) {
    console.error(err);
    req.flash("error", err.message || "Failed to process payment");
    res.redirect(`/customer/bookings/${req.params.id}`);
  }
});

export default router;
