import express from "express";
import { isLoggedIn, isStaff } from "../middleware/auth.js";
import Room from "../models/Room.js";
import Booking from "../models/booking.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";

const router = express.Router();

// Staff dashboard
router.get("/dashboard", isLoggedIn, isStaff, async (req, res) => {
  try {
    // Get pending bookings
    const pendingBookings = await Booking.find({ status: "pending" })
      .populate("customer")
      .populate("room")
      .sort({ checkInDate: 1 })
      .limit(5);

    // Get today's check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCheckIns = await Booking.find({
      status: { $in: ["confirmed", "checked-in"] }, // checked-in ( điều kiện )
      checkInDate: { $gte: today, $lt: tomorrow },
    })
      .populate("customer")
      .populate("room")
      .sort({ checkInDate: 1 });

    // Get pending service requests
    const pendingServiceRequests = await ServiceRequest.find({
      status: "pending",
    })
      .populate("customer")
      .populate("service")
      .populate({
        path: "booking",
        populate: { path: "room" },
      })
      .sort({ requestDate: -1 })
      .limit(5);

    res.render("staff/dashboard", {
      title: "Staff Dashboard",
      pendingBookings,
      todayCheckIns,
      pendingServiceRequests,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/");
  }
});

// Bookings management
router.get("/bookings", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status, search } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      // Search by customer name or room number
      const customers = await User.find({
        name: { $regex: search, $options: "i" },
      });

      const customerIds = customers.map((customer) => customer._id);

      const rooms = await Room.find({
        roomNumber: { $regex: search, $options: "i" },
      });

      const roomIds = rooms.map((room) => room._id);

      query.$or = [
        { customer: { $in: customerIds } },
        { room: { $in: roomIds } },
      ];
    }

    const bookings = await Booking.find(query)
      .populate("customer")
      .populate("room")
      .sort({ createdAt: -1 });

    res.render("staff/bookings", {
      title: "Manage Bookings",
      bookings,
      currentStatus: status || "all",
      search: search || "",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load bookings");
    res.redirect("/staff/dashboard");
  }
});

// Booking details
router.get("/bookings/:id", isLoggedIn, isStaff, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("customer")
      .populate("room");

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/staff/bookings");
    }

    // Get service requests for this booking
    const serviceRequests = await ServiceRequest.find({ booking: booking._id })
      .populate("service")
      .populate("assignedStaff")
      .sort({ requestDate: -1 });

    // Get payment history
    const payments = await Payment.find({ booking: booking._id })
      .populate("processedBy")
      .sort({ paymentDate: -1 });

    // Fetch available services for service request form
    const Service = (await import("../models/Service.js")).default;
    const availableServices = await Service.find({ available: true });

    // Fetch reviews for this booking
    const Review = (await import("../models/Review.js")).default;
    const reviews = await Review.find({ booking: booking._id });

    res.render("staff/booking-details", {
      title: "Booking Details",
      booking,
      serviceRequests,
      payments,
      availableServices,
      reviews, // <-- Pass reviews to EJS
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load booking details");
    res.redirect("/staff/bookings");
  }
});

// Update booking status
router.post("/bookings/:id/status", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/staff/bookings");
    }

    // Update booking status
    booking.status = status;
    booking.updatedBy = req.user._id;
    await booking.save();

    // Update room status based on booking status
    if (status === "confirmed") {
      await Room.findByIdAndUpdate(booking.room, { status: "occupied" });
    } else if (status === "checked-out") {
      await Room.findByIdAndUpdate(booking.room, { status: "cleaning" });

      // Add loyalty points for completed stay
      const room = await Room.findById(booking.room);
      const loyaltyPoints = Math.floor(booking.totalPrice / 10); // 1 point per $10 spent

      await User.findByIdAndUpdate(booking.customer, {
        $inc: { loyaltyPoints },
      });
    } else if (status === "cancelled") {
      await Room.findByIdAndUpdate(booking.room, { status: "available" });
    }

    // Create notification for customer
    const notification = new Notification({
      recipient: booking.customer,
      title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your booking status has been updated to ${status}.`,
      type: "booking",
      relatedTo: {
        model: "Booking",
        id: booking._id,
      },
    });

    await notification.save();

    req.flash("success", `Booking status updated to ${status}`);
    res.redirect(`/staff/bookings/${booking._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update booking status");
    res.redirect("/staff/bookings");
  }
});

// Process payment
router.post("/bookings/:id/payment", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId, notes } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/staff/bookings");
    }

    // Create payment record
    const payment = new Payment({
      booking: booking._id,
      amount: Number.parseFloat(amount),
      paymentMethod,
      transactionId,
      notes,
      status: "completed",
      processedBy: req.user._id,
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

    // Create notification for customer
    const notification = new Notification({
      recipient: booking.customer,
      title: "Payment Processed",
      message: `A payment of $${amount} has been processed for your booking.`,
      type: "payment",
      relatedTo: {
        model: "Payment",
        id: payment._id,
      },
    });

    await notification.save();

    req.flash("success", "Payment processed successfully");
    res.redirect(`/staff/bookings/${booking._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to process payment");
    res.redirect(`/staff/bookings/${req.params.id}`);
  }
});

// Room management
router.get("/rooms", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status, type } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (type && type !== "all") {
      query.type = type;
    }

    const rooms = await Room.find(query).sort({ roomNumber: 1 });

    res.render("staff/rooms", {
      title: "Manage Rooms",
      rooms,
      currentStatus: status || "all",
      currentType: type || "all",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load rooms");
    res.redirect("/staff/dashboard");
  }
});

// Update room status
router.post("/rooms/:id/status", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status } = req.body;

    await Room.findByIdAndUpdate(req.params.id, { status });

    req.flash("success", "Room status updated successfully");
    res.redirect("/staff/rooms");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update room status");
    res.redirect("/staff/rooms");
  }
});

// Service requests management
router.get("/service-requests", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    const serviceRequests = await ServiceRequest.find(query)
      .populate("customer")
      .populate("service")
      .populate({
        path: "booking",
        populate: { path: "room" },
      })
      .populate("assignedStaff")
      .sort({ requestDate: -1 });

    res.render("staff/service-requests", {
      title: "Manage Service Requests",
      serviceRequests,
      currentStatus: status || "all",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load service requests");
    res.redirect("/staff/dashboard");
  }
});

// Update service request
router.post("/service-requests/:id", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { status, notes, services } = req.body;

    if (Array.isArray(services)) {
      // Handle multiple services
      for (const serviceId of services) {
        // Process each service
      }
    } else if (services) {
      // Handle single service
      // Process single service
    }

    const serviceRequest = await ServiceRequest.findById(req.params.id);

    if (!serviceRequest) {
      req.flash("error", "Service request not found");
      return res.redirect("/staff/service-requests");
    }

    // Update service request
    serviceRequest.status = status;
    serviceRequest.notes = notes || serviceRequest.notes;
    serviceRequest.assignedStaff = req.user._id;

    if (status === "completed") {
      serviceRequest.completionDate = Date.now();
    }

    await serviceRequest.save();

    // Create notification for customer
    const notification = new Notification({
      recipient: serviceRequest.customer,
      title: "Service Request Update",
      message: `Your service request has been ${status}.`,
      type: "service",
      relatedTo: {
        model: "ServiceRequest",
        id: serviceRequest._id,
      },
    });

    await notification.save();

    req.flash("success", "Service request updated successfully");
    res.redirect("/staff/service-requests");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update service request");
    res.redirect("/staff/service-requests");
  }
});

// Customer management
router.get("/customers", isLoggedIn, isStaff, async (req, res) => {
  try {
    const { search } = req.query;

    const query = { role: "customer" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await User.find(query).sort({ name: 1 });

    res.render("staff/customers", {
      title: "Manage Customers",
      customers,
      search: search || "",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load customers");
    res.redirect("/staff/dashboard");
  }
});

// Customer details
router.get("/customers/:id", isLoggedIn, isStaff, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer || customer.role !== "customer") {
      req.flash("error", "Customer not found");
      return res.redirect("/staff/customers");
    }

    // Get customer's bookings
    const bookings = await Booking.find({ customer: customer._id })
      .populate("room")
      .sort({ createdAt: -1 });

    res.render("staff/customer-details", {
      title: "Customer Details",
      customer,
      bookings,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load customer details");
    res.redirect("/staff/customers");
  }
});

export default router;
