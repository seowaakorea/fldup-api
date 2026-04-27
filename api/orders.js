export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', 'https://fldup.com');

    const API_KEY = process.env.IMWEB_API_KEY;
    const SECRET_KEY = process.env.IMWEB_SECRET_KEY;

    // 👉 매출 대상 (고객사)
    const targetMembers = [
      {
        id: 'seowaa',
        memberCode: 'm20251111951335dbfdb68'
      },
      {
        id: 'yxxnpd',
        memberCode: 'm20251110646a2d71df48d'
      }
    ];

    // 👉 토큰 발급
    const tokenRes = await fetch(
      `https://api.imweb.me/v2/auth?key=${API_KEY}&secret=${SECRET_KEY}`
    );

    const tokenData = await tokenRes.json();
    const accessToken =
      tokenData.access_token ||
      tokenData.data?.access_token;

    // 👉 주문 조회 (30일)
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 30);

    const ordersRes = await fetch(
      `https://api.imweb.me/v2/shop/orders?order_date_from=${Math.floor(from.getTime()/1000)}&order_date_to=${Math.floor(now.getTime()/1000)}`,
      {
        headers: {
          'access-token': accessToken
        }
      }
    );

    const ordersData = await ordersRes.json();

    const orders =
      ordersData.data?.list ||
      ordersData.data ||
      [];

    // 👉 필터링 (member_code 기준)
    const filtered = orders.filter(o => {
      const code = o.orderer?.member_code;
      return targetMembers.some(m => m.memberCode === code);
    });

    // 👉 집계
    const summary = {};

    targetMembers.forEach(m => {
      summary[m.id] = {
        memberId: m.id,
        orderCount: 0,
        totalAmount: 0
      };
    });

    filtered.forEach(order => {
      const code = order.orderer?.member_code;

      const member = targetMembers.find(m => m.memberCode === code);

      if (!member) return;

      const amount =
        order.payment?.payment_amount || 0;

      summary[member.id].orderCount += 1;
      summary[member.id].totalAmount += amount;
    });

    // 👉 전체 합계
    const total = {
      orderCount: 0,
      amount: 0
    };

    Object.values(summary).forEach(s => {
      total.orderCount += s.orderCount;
      total.amount += s.totalAmount;
    });

    return res.status(200).json({
      ok: true,
      total,
      summaryByMember: Object.values(summary),
      orders: filtered.map(o => ({
        orderNo: o.order_no,
        memberCode: o.orderer?.member_code,
        name: o.orderer?.name,
        amount: o.payment?.payment_amount,
        date: o.order_time
      }))
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
