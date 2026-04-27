export default async function handler(req, res) {
  try {

    const API_KEY = process.env.IMWEB_API_KEY;
    const SECRET_KEY = process.env.IMWEB_SECRET_KEY;

    const tokenRes = await fetch(
      `https://api.imweb.me/v2/auth?key=${API_KEY}&secret=${SECRET_KEY}`
    );
    const tokenData = await tokenRes.json();

    const accessToken =
      tokenData.access_token ||
      tokenData.data?.access_token;

    const now = Math.floor(Date.now() / 1000);
    const before = now - (30 * 24 * 60 * 60);

    const orderRes = await fetch(
      `https://api.imweb.me/v2/shop/orders?order_date_from=${before}&order_date_to=${now}`,
      {
        headers: {
          'access-token': accessToken
        }
      }
    );

    const orderData = await orderRes.json();

    const orders =
      orderData.data?.list ||
      orderData.data ||
      [];

    // 🔥 핵심: 상태 관련 필드 전부 노출
    const debugOrders = orders.slice(0, 10).map(order => ({
      order_no: order.order_no,
      order_code: order.order_code,
      order_time: order.order_time,
      complete_time: order.complete_time,

      // 가능한 상태 필드
      order_status: order.order_status,
      status: order.status,

      payment: order.payment,
      delivery: order.delivery,
      claim: order.claim,
      cancel: order.cancel,

      raw: order
    }));

    return res.json({
      ok: true,
      totalOrders: orders.length,
      debugOrders
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err.message
    });
  }
}
