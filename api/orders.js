export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', 'https://fldup.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        message: 'GET 요청만 허용됩니다.'
      });
    }

    const API_KEY = process.env.IMWEB_API_KEY;
    const SECRET_KEY = process.env.IMWEB_SECRET_KEY;

    if (!API_KEY || !SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        message: 'Vercel 환경변수가 설정되지 않았습니다.'
      });
    }

    const allowedMemberIds = ['yxxnpd', 'seowaa'];

    const tokenUrl = `https://api.imweb.me/v2/auth?key=${encodeURIComponent(API_KEY)}&secret=${encodeURIComponent(SECRET_KEY)}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const tokenData = await tokenResponse.json();

    const accessToken =
      tokenData.access_token ||
      tokenData.accessToken ||
      tokenData.data?.access_token ||
      tokenData.data?.accessToken;

    if (!accessToken) {
      return res.status(500).json({
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
        'Content-Type': 'application/json',
        'access-token': accessToken
      }
    });

    const ordersData = await ordersResponse.json();

    const rawOrders =
      ordersData.data?.list ||
      ordersData.data?.orders ||
      ordersData.data ||
      ordersData.list ||
      [];

    const orders = Array.isArray(rawOrders) ? rawOrders : [];

    function getMemberId(order) {
      return (
        order.member_id ||
        order.memberId ||
        order.member?.id ||
        order.member?.member_id ||
        order.orderer?.member_id ||
        order.orderer?.id ||
        order.buyer?.member_id ||
        order.buyer?.id ||
        ''
      );
    }

    function getOrderAmount(order) {
      return Number(
        order.actual_payment_price ||
        order.payment_price ||
        order.total_price ||
        order.order_price ||
        order.price ||
        0
      );
    }

    function getOrderNo(order) {
      return (
        order.order_no ||
        order.orderNo ||
        order.order_code ||
        order.orderCode ||
        order.no ||
        ''
      );
    }

    function getOrderStatus(order) {
      return (
        order.status ||
        order.order_status ||
        order.orderStatus ||
        ''
      );
    }

    function getOrderDate(order) {
      return (
        order.order_time ||
        order.order_date ||
        order.orderDate ||
        order.created_at ||
        order.createdAt ||
        ''
      );
    }

    const filteredOrders = orders.filter((order) => {
      const memberId = getMemberId(order);
      return allowedMemberIds.includes(memberId);
    });

    const summaryByMember = {};

    allowedMemberIds.forEach((id) => {
      summaryByMember[id] = {
        memberId: id,
        orderCount: 0,
        totalAmount: 0
      };
    });

    const orderList = filteredOrders.map((order) => {
      const memberId = getMemberId(order);
      const amount = getOrderAmount(order);

      if (!summaryByMember[memberId]) {
        summaryByMember[memberId] = {
          memberId,
          orderCount: 0,
          totalAmount: 0
        };
      }

      summaryByMember[memberId].orderCount += 1;
      summaryByMember[memberId].totalAmount += amount;

      return {
        orderNo: getOrderNo(order),
        memberId,
        amount,
        status: getOrderStatus(order),
        orderDate: getOrderDate(order)
      };
    });

    const totalAmount = Object.values(summaryByMember).reduce((sum, row) => {
      return sum + row.totalAmount;
    }, 0);

    const totalOrderCount = Object.values(summaryByMember).reduce((sum, row) => {
      return sum + row.orderCount;
    }, 0);

    return res.status(200).json({
      ok: true,
      period: {
        days: 30,
        orderDateFrom,
        orderDateTo
      },
      allowedMemberIds,
      total: {
        orderCount: totalOrderCount,
        amount: totalAmount
      },
      summaryByMember: Object.values(summaryByMember),
      orders: orderList,
      debug: {
        fetchedOrderCount: orders.length,
        filteredOrderCount: filteredOrders.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: '주문 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}
