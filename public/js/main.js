document.addEventListener("DOMContentLoaded", () => {
  // Initialize tooltips
  var tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  var tooltipList = tooltipTriggerList.map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
  );

  // Initialize date pickers
  const dateInputs = document.querySelectorAll('input[type="date"]');
  if (dateInputs) {
    dateInputs.forEach((input) => {
      // Set min date to today for check-in dates
      if (input.id === "checkInDate") {
        const today = new Date().toISOString().split("T")[0];
        input.setAttribute("min", today);
      }

      // Set min date for check-out based on check-in
      if (input.id === "checkInDate") {
        input.addEventListener("change", function () {
          const checkOutInput = document.getElementById("checkOutDate");
          if (checkOutInput) {
            // Set min date to check-in date + 1 day
            const checkInDate = new Date(this.value);
            checkInDate.setDate(checkInDate.getDate() + 1);
            const minCheckOutDate = checkInDate.toISOString().split("T")[0];
            checkOutInput.setAttribute("min", minCheckOutDate);

            // If current check-out date is before new min, update it
            if (
              checkOutInput.value &&
              new Date(checkOutInput.value) < checkInDate
            ) {
              checkOutInput.value = minCheckOutDate;
            }
          }
        });
      }
    });
  }

  // Room booking price calculator
  const roomSelect = document.getElementById("roomId");
  const checkInInput = document.getElementById("checkInDate");
  const checkOutInput = document.getElementById("checkOutDate");
  const totalPriceDisplay = document.getElementById("totalPrice");

  if (roomSelect && checkInInput && checkOutInput && totalPriceDisplay) {
    const calculateTotal = () => {
      const roomId = roomSelect.value;
      const checkIn = new Date(checkInInput.value);
      const checkOut = new Date(checkOutInput.value);

      if (roomId && !isNaN(checkIn) && !isNaN(checkOut) && checkOut > checkIn) {
        // Get selected room price from data attribute
        const selectedOption = roomSelect.options[roomSelect.selectedIndex];
        const roomPrice = Number.parseFloat(
          selectedOption.getAttribute("data-price")
        );

        // Calculate number of days
        const days = Math.ceil((checkOut - checkIn) / (1000 * 3600 * 24));

        // Calculate total price
        const totalPrice = roomPrice * days;

        // Update display
        totalPriceDisplay.textContent = `${totalPrice.toFixed(2)}`;
      } else {
        totalPriceDisplay.textContent = "$0.00";
      }
    };

    // Calculate on change
    roomSelect.addEventListener("change", calculateTotal);
    checkInInput.addEventListener("change", calculateTotal);
    checkOutInput.addEventListener("change", calculateTotal);
  }

  // Service request form
  const serviceSelect = document.getElementById("serviceId");
  const servicePriceDisplay = document.getElementById("servicePrice");

  if (serviceSelect && servicePriceDisplay) {
    serviceSelect.addEventListener("change", () => {
      const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
      const servicePrice = Number.parseFloat(
        selectedOption.getAttribute("data-price")
      );

      if (!isNaN(servicePrice)) {
        servicePriceDisplay.textContent = `${servicePrice.toFixed(2)}`;
      } else {
        servicePriceDisplay.textContent = "$0.00";
      }
    });
  }

  // Confirm delete models
  const deleteButtons = document.querySelectorAll(".btn-delete");
  if (deleteButtons) {
    deleteButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        if (
          !confirm(
            "Are you sure you want to delete this item? This action cannot be undone."
          )
        ) {
          e.preventDefault();
        }
      });
    });
  }

  // Confirm booking cancellation
  const cancelBookingButtons = document.querySelectorAll(".btn-cancel-booking");
  if (cancelBookingButtons) {
    cancelBookingButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        if (
          !confirm(
            "Bạn có chắc muốn hủy đặt phòng này không? Hành động này không thể hoàn tác."
          )
        ) {
          e.preventDefault();
        }
      });
    });
  }

  // Room filter
  const roomFilterForm = document.getElementById("roomFilterForm");
  if (roomFilterForm) {
    roomFilterForm.addEventListener("submit", (e) => {
      // Remove empty fields from form submission
      const inputs = roomFilterForm.querySelectorAll("input, select");
      inputs.forEach((input) => {
        if (input.value === "" || input.value === "all") {
          input.disabled = true;
        }
      });
    });
  }

  // Notification badge updater
  const updateNotificationBadge = async () => {
    const badge = document.getElementById("notificationBadge");
    if (badge) {
      try {
        const response = await fetch("/api/notifications/unread-count");
        const data = await response.json();

        if (data.count > 0) {
          badge.textContent = data.count;
          badge.classList.remove("d-none");
        } else {
          badge.classList.add("d-none");
        }
      } catch (err) {
        console.error("Failed to fetch notification count:", err);
      }
    }
  };

  // Update notification badge on page load
  updateNotificationBadge();

  // Update notification badge every minute
  setInterval(updateNotificationBadge, 60000);

  //Charts for admin dashboard
  const bookingChart = document.getElementById("bookingChart");
  if (bookingChart) {
    fetch("/admin/api/booking-stats")
      .then((response) => response.json())
      .then((data) => {
        new Chart(bookingChart, {
          type: "bar",
          data: {
            labels: data.labels,
            datasets: [
              {
                label: "Bookings",
                data: data.values,
                backgroundColor: "rgba(0, 123, 255, 0.5)",
                borderColor: "rgba(0, 123, 255, 1)",
                borderWidth: 1,
              },
            ],
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          },
        });
      })
      .catch((err) => console.error("Failed to load booking stats:", err));
  }

  const revenueChart = document.getElementById("revenueChart");
  if (revenueChart) {
    fetch("/admin/api/revenue-stats")
      .then((response) => response.json())
      .then((data) => {
        new Chart(revenueChart, {
          type: "line",
          data: {
            labels: data.labels,
            datasets: [
              {
                label: "Revenue",
                data: data.values,
                backgroundColor: "rgba(40, 167, 69, 0.2)",
                borderColor: "rgba(40, 167, 69, 1)",
                borderWidth: 2,
                tension: 0.1,
              },
            ],
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value) => "$" + value,
                },
              },
            },
          },
        });
      })
      .catch((err) => console.error("Failed to load revenue stats:", err));
  }
});
