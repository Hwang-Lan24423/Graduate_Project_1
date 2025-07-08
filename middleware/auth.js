// Authentication middleware
// Check if user is logged in
export const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "Please log in first");
  res.redirect("/auth/login");
};

// Add returnTo handling in login route
export const handleLoginRedirect = (req, res, next) => {
  if (req.session.returnTo) {
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo);
  } else {
    // Redirect based on user role
    if (req.user.role === "admin") {
      res.redirect("/admin/dashboard");
    } else if (req.user.role === "staff") {
      res.redirect("/staff/dashboard");
    } else {
      res.redirect("/customer/dashboard");
    }
  }
};

// Check if user is staff
export const isStaff = (req, res, next) => {
  if (req.user && (req.user.role === "staff" || req.user.role === "admin")) {
    return next();
  }
  req.flash("error", "Access denied");
  res.redirect("/");
};

// Check if user is admin
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  req.flash("error", "Access denied");
  res.redirect("/");
};

// Check if user is customer
export const isCustomer = (req, res, next) => {
  if (req.user && req.user.role === "customer") {
    return next();
  }
  req.flash("error", "Access denied");
  res.redirect("/");
};