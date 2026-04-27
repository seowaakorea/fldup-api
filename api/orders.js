export default async function handler(req, res) {
  try {
    const allowedOrigins = [
      'https://fldup.com',
      'https://www.fldup.com',
      'https://seowaa.imweb.me'
    ];

    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://fldup.com');
    }

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

    const targetMembers = [
      {
        memberId: 'seowaa',
        displayName: '서와',
        memberCode: 'm20251111951335dbfdb68'
      },
      {
        memberId: 'yxxnpd',
        displayName: '서와주식회사(테스트)',
        memberCode: 'm20251110646a2d71df48d'
      }
    ];

    const tokenUrl =
      `https://api.imweb.me/v2/auth?key=${encodeURIComponent(API_KEY)}&secret=${encodeURIComponent(SECRET_KEY)}`;

    const tokenRes = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    const tokenData = await tokenRes.json();

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

    const ordersRes = await fetch(ordersUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'access-token': accessToken
      }
    });

    const ordersData = await ordersRes.json();

    const rawOrders =
      ordersData.data?.list ||
      ordersData.data?.orders ||
      ordersData.data ||
      ordersData.list ||
      ordersData.orders ||
      [];

    const orders = Array.isArray(rawOrders) ? rawOrders : [];

    function getTargetMemberByCode(memberCode) {
      return targetMembers.find(function (member) {
        return member.memberCode === memberCode;
      });
    }

    function getOrderProducts(order) {
      const candidates =
        order.items ||
        order.order_items ||
        order.products ||
        order.prod_list ||
        order.product_list ||
        order.goods ||
        [];

      if (!Array.isArray(candidates)) return [];

      return candidates.map(function (item) {
        return {
          name:
            item.name ||
            item.prod_name ||
            item.product_name ||
            item.goods_name ||
            '-',
          count:
            item.count ||
            item.quantity ||
            item.order_count ||
            1,
          price:
            item.price ||
            item.sale_price ||
            item.total_price ||
            0
        };
      });
    }

    const filteredOrders = orders.filter(function (order) {
      const memberCode = order.orderer?.member_code || '';
      return !!getTargetMemberByCode(memberCode);
    });

    const summaryMap = {};

    targetMembers.forEach(function (member) {
      summaryMap[member.memberCode] = {
        memberId: member.memberId,
        memberCode: member.memberCode,
        displayName: member.displayName,
        orderCount: 0,
        totalAmount: 0
      };
    });

    const orderList = filteredOrders.map(function (order) {
      const memberCode = order.orderer?.member_code || '';
      const target = getTargetMemberByCode(memberCode);

      const amount = Number(order.payment?.payment_amount || 0);
      const productItems = getOrderProducts(order);

      if (summaryMap[memberCode]) {
        summaryMap[memberCode].orderCount += 1;
        summaryMap[memberCode].totalAmount += amount;
      }

      return {
        orderNo: order.order_no || order.order_code || '',
        orderCode: order.order_code || '',
        memberId: target?.memberId || '',
        memberCode: memberCode,
        name: target?.displayName || order.orderer?.name || '',
        ordererName: order.orderer?.name || '',
        email: order.orderer?.email || '',
        phone: order.orderer?.call || '',
        amount: amount,
        totalProductPrice: Number(order.payment?.total_price || 0),
        deliveryPrice: Number(order.payment?.deliv_price || 0),
        payType: order.payment?.pay_type || '',
        paymentTime: order.payment?.payment_time || 0,
        orderTime: order.order_time || 0,
        completeTime: order.complete_time || 0,
        device: order.device?.type || '',
        products: productItems,
        productSummary: productItems.length
          ? productItems.map(function (p) {
              return p.name + ' x ' + p.count;
            }).join(', ')
          : '-'
      };
    });

    const summaryByMember = Object.values(summaryMap);

    const total = summaryByMember.reduce(function (acc, row) {
      acc.orderCount += row.orderCount;
      acc.amount += row.totalAmount;
      return acc;
    }, {
      orderCount: 0,
      amount: 0
    });

    return res.status(200).json({
      ok: true,
      period: {
        days: 30,
        orderDateFrom,
        orderDateTo
      },
      total: total,
      summaryByMember: summaryByMember,
      orders: orderList,
      debug: {
        fetchedOrderCount: orders.length,
        filteredOrderCount: filteredOrders.length,
        sampleOrderKeys: orders[0] ? Object.keys(orders[0]) : [],
        note: '현재는 테스트용 member_code 기준 필터링입니다.'
      }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: '주문 데이터 조회 중 오류가 발생했습니다.',
      error: err.message
    });
  }
}
