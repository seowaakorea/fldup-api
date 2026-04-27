export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', 'https://fldup.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const API_KEY = (process.env.IMWEB_API_KEY || '').trim();
    const SECRET_KEY = (process.env.IMWEB_SECRET_KEY || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        message: 'Vercel 환경변수 IMWEB_API_KEY 또는 IMWEB_SECRET_KEY가 없습니다.'
      });
    }

    const tokenUrl =
      `https://api.imweb.me/v2/auth?key=${encodeURIComponent(API_KEY)}&secret=${encodeURIComponent(SECRET_KEY)}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    const tokenData = await tokenResponse.json();

    const accessToken =
      tokenData.access_token ||
      tokenData.accessToken ||
      tokenData.token ||
      tokenData.data?.access_token ||
      tokenData.data?.accessToken ||
      tokenData.data?.token;

    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        message: '아임웹 access token 발급 실패',
        raw: tokenData
      });
    }

    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 30);

    const orderDateFrom = Math.floor(from.getTime() / 1000);
    const orderDateTo = Math.floor(now.getTime() / 1000);

    const ordersUrl =
      `https://api.imweb.me/v2/shop/orders` +
      `?order_date_from=${orderDateFrom}` +
      `&order_date_to=${orderDateTo}`;

    const ordersResponse = await fetch(ordersUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'access-token': accessToken
      }
    });

    const ordersData = await ordersResponse.json();

    const rawOrders =
      ordersData.data?.list ||
      ordersData.data?.orders ||
      ordersData.data ||
      ordersData.list ||
      ordersData.orders ||
      [];

    const orders = Array.isArray(rawOrders) ? rawOrders : [];

    const orderers = orders.map((order) => {
      return {
        orderNo:
          order.order_no ||
          order.orderNo ||
          order.order_code ||
          order.orderCode ||
          '',

        orderCode:
          order.order_code ||
          order.orderCode ||
          '',

        orderTime:
          order.order_time ||
          order.order_date ||
          order.created_at ||
          '',

        memberCode:
          order.orderer?.member_code || '',

        name:
          order.orderer?.name || '',

        email:
          order.orderer?.email || '',

        phone:
          order.orderer?.call || '',

        payType:
          order.payment?.pay_type || '',

        totalPrice:
          Number(order.payment?.total_price || 0),

        paymentAmount:
          Number(order.payment?.payment_amount || 0),

        paymentTime:
          order.payment?.payment_time || '',

        completeTime:
          order.complete_time || 0
      };
    });

    const uniqueOrderersMap = {};

    orderers.forEach((row) => {
      const key = row.memberCode || row.email || row.name || 'unknown';

      if (!uniqueOrderersMap[key]) {
        uniqueOrderersMap[key] = {
          memberCode: row.memberCode,
          name: row.name,
          email: row.email,
          phone: row.phone,
          orderCount: 0,
          totalPaymentAmount: 0,
          lastOrderNo: '',
          lastOrderTime: ''
        };
      }

      uniqueOrderersMap[key].orderCount += 1;
      uniqueOrderersMap[key].totalPaymentAmount += row.paymentAmount;
      uniqueOrderersMap[key].lastOrderNo = row.orderNo;
      uniqueOrderersMap[key].lastOrderTime = row.orderTime;
    });

    return res.status(200).json({
      ok: true,
      mode: 'member_code_check',
      message: '최근 30일 주문자 member_code 확인용 응답입니다.',
      period: {
        days: 30,
        orderDateFrom,
        orderDateTo
      },
      debug: {
        fetchedOrderCount: orders.length
      },
      uniqueOrderers: Object.values(uniqueOrderersMap),
      orders: orderers
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: '주문자 member_code 확인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}
