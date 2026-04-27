export default async function handler(req, res) {
  try {
res.setHeader(
  'Content-Security-Policy',
  "frame-ancestors https://fldup.com https://www.fldup.com https://seowaa.imweb.me"
);
res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    const API_KEY = (process.env.IMWEB_API_KEY || '').trim();
    const SECRET_KEY = (process.env.IMWEB_SECRET_KEY || '').trim();

    const targetMembers = [
      { memberId: 'seowaa', displayName: '서와', memberCode: 'm20251111951335dbfdb68' },
      { memberId: 'yxxnpd', displayName: '서와주식회사(테스트)', memberCode: 'm20251110646a2d71df48d' }
    ];

    const tokenUrl = `https://api.imweb.me/v2/auth?key=${encodeURIComponent(API_KEY)}&secret=${encodeURIComponent(SECRET_KEY)}`;
    const tokenRes = await fetch(tokenUrl, { headers: { Accept: 'application/json' } });
    const tokenData = await tokenRes.json();

    const accessToken =
      tokenData.access_token ||
      tokenData.accessToken ||
      tokenData.token ||
      tokenData.data?.access_token ||
      tokenData.data?.accessToken ||
      tokenData.data?.token;

    if (!accessToken) throw new Error('아임웹 access token 발급 실패');

    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 30);

    const orderDateFrom = Math.floor(from.getTime() / 1000);
    const orderDateTo = Math.floor(now.getTime() / 1000);

    const ordersUrl =
      `https://api.imweb.me/v2/shop/orders?order_date_from=${orderDateFrom}&order_date_to=${orderDateTo}`;

    const ordersRes = await fetch(ordersUrl, {
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

    function getTargetMemberByCode(code) {
      return targetMembers.find(m => m.memberCode === code);
    }

    const summaryMap = {};
    targetMembers.forEach(m => {
      summaryMap[m.memberCode] = {
        memberId: m.memberId,
        displayName: m.displayName,
        orderCount: 0,
        totalAmount: 0
      };
    });

    const filteredOrders = orders
      .filter(order => getTargetMemberByCode(order.orderer?.member_code || ''))
      .map(order => {
        const memberCode = order.orderer?.member_code || '';
        const target = getTargetMemberByCode(memberCode);
        const amount = Number(order.payment?.payment_amount || 0);

        summaryMap[memberCode].orderCount += 1;
        summaryMap[memberCode].totalAmount += amount;

        return {
          orderNo: order.order_no || order.order_code || '',
          name: target?.displayName || order.orderer?.name || '',
          amount,
          orderTime: order.order_time || 0,
          payType: order.payment?.pay_type || '',
          totalProductPrice: Number(order.payment?.total_price || 0),
          deliveryPrice: Number(order.payment?.deliv_price || 0)
        };
      });

    const summary = Object.values(summaryMap);
    const totalOrderCount = summary.reduce((sum, row) => sum + row.orderCount, 0);
    const totalAmount = summary.reduce((sum, row) => sum + row.totalAmount, 0);

    function won(num) {
      return Number(num || 0).toLocaleString('ko-KR') + '원';
    }

    function dateText(value) {
      if (!value) return '-';
      const d = new Date(Number(value) * 1000);
      if (isNaN(d.getTime())) return '-';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const memberRows = summary.map(row => `
      <tr>
        <td>${row.memberId}</td>
        <td>${row.displayName}</td>
        <td>${row.orderCount.toLocaleString('ko-KR')}건</td>
        <td>${won(row.totalAmount)}</td>
      </tr>
    `).join('');

    const orderRows = filteredOrders.length
      ? filteredOrders.map(order => `
        <tr>
          <td>${order.orderNo}</td>
          <td>${order.name}</td>
          <td>${won(order.amount)}</td>
          <td>${dateText(order.orderTime)}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" class="empty">최근 주문 내역이 없습니다.</td></tr>`;

    const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body{
    margin:0;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",Arial,sans-serif;
    color:#111;
    background:#fff;
  }
  .wrap{
    max-width:1200px;
    margin:0 auto;
    padding:40px 20px;
  }
  .head{
    display:flex;
    justify-content:space-between;
    gap:20px;
    align-items:flex-end;
    margin-bottom:28px;
  }
  .kicker{
    margin:0 0 8px;
    color:#666;
    font-size:13px;
    font-weight:800;
    letter-spacing:.02em;
  }
  h1{
    margin:0 0 10px;
    font-size:34px;
    font-weight:900;
    letter-spacing:-0.06em;
  }
  .desc{
    margin:0;
    color:#555;
    font-size:15px;
  }
  .refresh{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:#ff7a00;
    color:#fff;
    text-decoration:none;
    border-radius:10px;
    padding:14px 20px;
    font-size:14px;
    font-weight:800;
  }
  .summary{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:16px;
    margin-bottom:28px;
  }
  .card{
    background:#fff;
    border:1px solid #eee;
    border-radius:16px;
    padding:24px;
    box-shadow:0 8px 24px rgba(0,0,0,.05);
  }
  .card span{
    display:block;
    margin-bottom:12px;
    color:#777;
    font-size:14px;
    font-weight:800;
  }
  .card strong{
    display:block;
    color:#ff7a00;
    font-size:32px;
    font-weight:900;
    letter-spacing:-0.04em;
  }
  .section{
    background:#fff;
    border:1px solid #eee;
    border-radius:16px;
    padding:24px;
    margin-bottom:18px;
    box-shadow:0 8px 24px rgba(0,0,0,.04);
  }
  h2{
    margin:0 0 16px;
    font-size:21px;
    font-weight:900;
    letter-spacing:-0.05em;
  }
  .table-wrap{
    width:100%;
    overflow-x:auto;
  }
  table{
    width:100%;
    border-collapse:collapse;
    min-width:720px;
  }
  th,td{
    padding:14px 12px;
    border-bottom:1px solid #eee;
    text-align:left;
    font-size:14px;
  }
  th{
    background:#fafafa;
    color:#555;
    font-weight:900;
  }
  .empty{
    text-align:center;
    color:#999;
  }
  @media(max-width:768px){
    .wrap{padding:28px 16px;}
    .head{flex-direction:column;align-items:flex-start;}
    h1{font-size:28px;}
    .refresh{width:100%;box-sizing:border-box;}
    .summary{grid-template-columns:1fr;}
    .card,.section{padding:18px;border-radius:14px;}
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">FIELDUP PARTNER SALES</p>
        <h1>부자재 매출 확인</h1>
        <p class="desc">협력 영업 고객사의 주문 건수와 매출을 확인할 수 있습니다.</p>
      </div>
      <a class="refresh" href="/api/first">새로고침</a>
    </div>

    <div class="summary">
      <div class="card">
        <span>총 주문건수</span>
        <strong>${totalOrderCount.toLocaleString('ko-KR')}건</strong>
      </div>
      <div class="card">
        <span>총 매출</span>
        <strong>${won(totalAmount)}</strong>
      </div>
    </div>

    <div class="section">
      <h2>고객사별 매출</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>고객사 ID</th>
              <th>고객사명</th>
              <th>주문건수</th>
              <th>매출금액</th>
            </tr>
          </thead>
          <tbody>${memberRows}</tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>최근 주문 내역</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>주문번호</th>
              <th>고객명</th>
              <th>주문금액</th>
              <th>주문일</th>
            </tr>
          </thead>
          <tbody>${orderRows}</tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(`
      <div style="font-family:sans-serif;padding:30px;color:#111;">
        <h2>데이터 조회 오류</h2>
        <p>${err.message}</p>
      </div>
    `);
  }
}
