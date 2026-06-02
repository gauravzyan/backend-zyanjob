const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../config/db');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key'
});

exports.createOrder = async (req, res) => {
  const { plan_id } = req.body;
  try {
    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'Plan ID is required.' });
    }

    const [plans] = await pool.query('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
    if (plans.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }
    const plan = plans[0];

    // Handle Free Plan (Price = 0) directly
    if (parseFloat(plan.price) === 0) {
      const startsAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(startsAt.getDate() + plan.duration_days);

      // Create active subscription directly
      const [subResult] = await pool.query(
        'INSERT INTO subscriptions (user_id, plan_id, starts_at, expires_at, status, razorpay_subscription_id) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, plan.id, startsAt, expiresAt, 'active', 'free_activated_directly']
      );

      // Save a succeeded payment record
      await pool.query(
        'INSERT INTO payments (subscription_id, user_id, amount, currency, gateway, payment_intent_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [subResult.insertId, req.user.id, 0.00, 'INR', 'razorpay', `free_${Date.now()}`, 'succeeded']
      );

      // Update employer plan ID cache
      await pool.query('UPDATE employers SET subscription_plan_id = ? WHERE user_id = ?', [plan.id, req.user.id]);

      return res.status(200).json({
        success: true,
        isFree: true,
        message: 'Free Plan activated successfully!'
      });
    }

    const options = {
      amount: Math.round(plan.price * 100), // Razorpay operates in paise
      currency: 'INR',
      receipt: `receipt_plan_${plan.id}_${Date.now()}`
    };

    let order;
    let isMock = false;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpError) {
      if (process.env.RAZORPAY_KEY_ID === 'rzp_test_placeholder_key' || (rzpError.statusCode && rzpError.statusCode === 401) || rzpError.message?.includes('auth') || rzpError.message?.includes('key')) {
        console.warn('⚠️ Razorpay returned auth error. Falling back to Zyan Payment Simulator Mock Order.');
        isMock = true;
        order = {
          id: `order_mock_${Math.random().toString(36).substring(2, 15)}`,
          amount: options.amount,
          currency: options.currency
        };
      } else {
        throw rzpError;
      }
    }

    // Save a pending payment record
    await pool.query(
      'INSERT INTO payments (user_id, amount, currency, gateway, payment_intent_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, plan.price, 'INR', 'razorpay', order.id, 'pending']
    );

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      is_mock: isMock,
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key'
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return res.status(500).json({ success: false, message: 'Could not create order.' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id } = req.body;
  try {
    if (!razorpay_order_id || !plan_id) {
      return res.status(400).json({ success: false, message: 'Missing payment confirmation parameters.' });
    }

    const isMock = razorpay_order_id.startsWith('order_mock_');

    if (!isMock) {
      if (!razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Missing signature verification parameters.' });
      }
      // Verify signature
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key');
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generated_signature = hmac.digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
      }
    }

    // Find and update the payment state
    const [payments] = await pool.query('SELECT * FROM payments WHERE payment_intent_id = ?', [razorpay_order_id]);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Associated payment order record not found.' });
    }

    const [plans] = await pool.query('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
    const plan = plans[0];

    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(startsAt.getDate() + plan.duration_days);

    // Create active subscription
    const [subResult] = await pool.query(
      'INSERT INTO subscriptions (user_id, plan_id, starts_at, expires_at, status, razorpay_subscription_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, plan.id, startsAt, expiresAt, 'active', razorpay_payment_id]
    );

    // Update payment record with success state and subscription association
    await pool.query(
      'UPDATE payments SET status = "succeeded", subscription_id = ? WHERE payment_intent_id = ?',
      [subResult.insertId, razorpay_order_id]
    );

    // Update employer plan ID cache
    await pool.query('UPDATE employers SET subscription_plan_id = ? WHERE user_id = ?', [plan.id, req.user.id]);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated successfully.',
      subscription_id: subResult.insertId
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
