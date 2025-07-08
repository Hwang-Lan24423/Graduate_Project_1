// Hàm mô phỏng xử lý thanh toán qua cổng thanh toán
async function processPayment(paymentMethod, amount, bookingId) {
    // Mô phỏng gọi API thanh toán
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Mô phỏng xử lý thành công 90% các trường hợp
            if (Math.random() < 0.9) {
                resolve({
                    success: true,
                    transactionId: 'TXN' + Date.now(),
                    message: 'Thanh toán thành công',
                    paymentMethod,
                    amount,
                    bookingId
                });
            } else {
                reject({
                    success: false,
                    message: 'Thanh toán thất bại, vui lòng thử lại'
                });
            }
        }, 2000); // Delay 2s để mô phỏng quá trình xử lý
    });
}

// Xác thực thông tin thanh toán
function validatePayment(paymentMethod, amount) {
    if (!paymentMethod) {
        throw new Error('Phương thức thanh toán không hợp lệ');
    }
    if (!amount || amount <= 0) {
        throw new Error('Số tiền thanh toán không hợp lệ');
    }
}

export {
    processPayment,
    validatePayment
};