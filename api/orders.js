export default async function handler(req, res) {
  function sendData(payload) {
    const callback = req.query.callback;

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.status(200).send(`${callback}(${JSON.stringify(payload)});`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).json(payload);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const API_KEY = (process.env.IMWEB_API_KEY || '').trim();
    const SECRET_KEY = (process.env.IMWEB_SECRET_KEY || '').trim();

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
      headers: { Accept: 'application/json' }
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
      return sendData({
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
      return targetMembers.find(member => member.memberCode === memberCode);
    }

    const filteredOrders = orders.filter(order => {
      const memberCode = order.orderer?.member_code || '';
      return !!getTargetMemberByCode(memberCode);
    });

    const summaryMap = {};

    targetMembers.forEach(member => {
      summaryMap[member.memberCode] = {
        memberId: member.memberId,
        memberCode: member.memberCode,
        displayName: member.displayName,
        orderCount: 0,
        totalAmount: 0
      };
    });

    const orderList = filteredOrders.map(order => {
      const memberCode = order.orderer?.member_code || '';
      const target = getTargetMemberByCode(memberCode);
      const amount = Number(order.payment?.payment_amount || 0);

      if (summaryMap[memberCode]) {
        summaryMap[memberCode].orderCount += 1;
        summaryMap[memberCode].totalAmount += amount;
      }

      return {
        orderNo: order.order_no || order.order_code || '',
        orderCode: order.order_code || '',
        memberId: target?.memberId || '',
        memberCode,
        name: target?.displayName || order.orderer?.name || '',
        ordererName: order.orderer?.name || '',
        amount,
        totalProductPrice: Number(order.payment?.total_price || 0),
        deliveryPrice: Number(order.payment?.deliv_price || 0),
        payType: order.payment?.pay_type || '',
        paymentTime: order.payment?.payment_time || 0,
        orderTime: order.order_time || 0,
        completeTime: order.complete_time || 0,
        device: order.device?.type || ''
      };
    });

    const summaryByMember = Object.values(summaryMap);

    const total = summaryByMember.reduce((acc, row) => {
      acc.orderCount += row.orderCount;
      acc.amount += row.totalAmount;
      return acc;
    }, {
      orderCount: 0,
      amount: 0
    });

    return sendData({
      ok: true,
      period: {
        days: 30,
        orderDateFrom,
        orderDateTo
      },
      total,
      summaryByMember,
      orders: orderList
    });

  } catch (err) {
    return sendData({
      ok: false,
      message: '주문 데이터 조회 중 오류가 발생했습니다.',
      error: err.message
    });
  }
}
