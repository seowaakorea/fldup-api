export default async function handler(req, res) {
  try {
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';

    const allowedDomains = [
      'fldup.com',
      'www.fldup.com',
      'seowaa.imweb.me'
    ];

    const isAllowed = allowedDomains.some(domain =>
      referer.includes(domain) || origin.includes(domain)
    );

    if (!isAllowed) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(403).send(`
        <div style="font-family:sans-serif;padding:40px;text-align:center;color:#111;">
          <h2>접근이 제한된 페이지입니다</h2>
          <p>정상적인 경로를 통해 접속해주세요.</p>
        </div>
      `);
    }

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
      throw new Error('아임웹 access token 발급 실패');
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

    function won(num) {
      return Number(num || 0).toLocaleString('ko-KR') + '원';
    }

    function dateText(value) {
      if (!value) return '-';

      const date = new Date(Number(value) * 1000);
      if (isNaN(date.getTime())) return '-';

      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async function getProdOrderStatus(orderNo) {
      const url =
        `https://api.imweb.me/v2/shop/prod-orders` +
        `?order_no=${encodeURIComponent(orderNo)}` +
        `&order_version=v2`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'access-token': accessToken
        }
      });

      const data = await response.json();

      const statuses = [];

      const root = data?.data?.[orderNo];

      if (root && typeof root === 'object') {
        Object.values(root).forEach(prodOrder => {
          if (!prodOrder || typeof prodOrder !== 'object') return;

          statuses.push({
            prodOrderNo: prodOrder.order_no || '',
            status: prodOrder.status || '',
            rawStatus: prodOrder.status || '',
            itemNames: Array.isArray(prodOrder.items)
              ? prodOrder.items.map(item => item.prod_name).filter(Boolean)
              : []
          });
        });
      }

      return {
        orderNo,
        statuses,
        isCanceled: statuses.some(row => {
          const status = String(row.status || '').toUpperCase();
          return (
            status.includes('CANCEL') ||
            status.includes('REFUND') ||
            status.includes('RETURN')
          );
        })
      };
    }

    const targetOrders = orders.filter(order => {
      const memberCode = order.orderer?.member_code || '';
      return !!getTargetMemberByCode(memberCode);
    });

    const summaryMap = {};

    targetMembers.forEach(member => {
      summaryMap[member.memberCode] = {
        memberId: member.memberId,
        displayName: member.displayName,
        memberCode: member.memberCode,
        normalOrderCount: 0,
        normalAmount: 0,
        cancelOrderCount: 0,
        cancelAmount: 0,
        totalOrderCount: 0
      };
    });

    const orderRows = [];

    for (const order of targetOrders) {
      const memberCode = order.orderer?.member_code || '';
      const target = getTargetMemberByCode(memberCode);
      const amount = Number(order.payment?.payment_amount || 0);
      const orderNo = order.order_no || order.order_code || '';

      let prodStatusInfo = {
        isCanceled: false,
        statuses: []
      };

      try {
        prodStatusInfo = await getProdOrderStatus(orderNo);
      } catch (statusError) {
        prodStatusInfo = {
          isCanceled: false,
          statuses: [],
          error: statusError.message
        };
      }

      const canceled = prodStatusInfo.isCanceled;

      if (summaryMap[memberCode]) {
        summaryMap[memberCode].totalOrderCount += 1;

        if (canceled) {
          summaryMap[memberCode].cancelOrderCount += 1;
          summaryMap[memberCode].cancelAmount += amount;
        } else {
          summaryMap[memberCode].normalOrderCount += 1;
          summaryMap[memberCode].normalAmount += amount;
        }
      }

      const productSummary = prodStatusInfo.statuses
        .flatMap(row => row.itemNames || [])
        .filter(Boolean)
        .join(', ') || '-';

      orderRows.push({
        orderNo,
        orderCode: order.order_code || '',
        name: target?.displayName || order.orderer?.name || '',
        ordererName: order.orderer?.name || '',
        memberId: target?.memberId || '',
        memberCode,
        amount,
        totalProductPrice: Number(order.payment?.total_price || 0),
        deliveryPrice: Number(order.payment?.deliv_price || 0),
        payType: order.payment?.pay_type || '',
        paymentTime: Number(order.payment?.payment_time || 0),
        orderTime: Number(order.order_time || 0),
        completeTime: Number(order.complete_time || 0),
        device: order.device?.type || '',
        status: canceled ? '취소/환불' : '정상',
        productSummary,
        prodOrderStatuses: prodStatusInfo.statuses
      });
    }

    const summary = Object.values(summaryMap);

    const totalNormalOrderCount = summary.reduce((sum, row) => sum + row.normalOrderCount, 0);
    const totalNormalAmount = summary.reduce((sum, row) => sum + row.normalAmount, 0);
    const totalCancelOrderCount = summary.reduce((sum, row) => sum + row.cancelOrderCount, 0);
    const totalCancelAmount = summary.reduce((sum, row) => sum + row.cancelAmount, 0);

    const memberRows = summary.map(row => `
      <tr>
        <td>${escapeHtml(row.memberId)}</td>
        <td>${escapeHtml(row.displayName)}</td>
        <td>${row.normalOrderCount.toLocaleString('ko-KR')}건</td>
        <td class="amount">${won(row.normalAmount)}</td>
        <td class="cancel">${row.cancelOrderCount.toLocaleString('ko-KR')}건</td>
        <td class="cancel">${won(row.cancelAmount)}</td>
      </tr>
    `).join('');

    const recentOrderRows = orderRows.length
      ? orderRows.map(order => `
        <tr class="${order.status === '취소/환불' ? 'is-cancel' : ''}">
          <td>${escapeHtml(order.orderNo)}</td>
          <td>${escapeHtml(order.name)}</td>
          <td>${escapeHtml(order.productSummary)}</td>
          <td>${won(order.amount)}</td>
          <td>${dateText(order.orderTime)}</td>
          <td>
            <span class="status ${order.status === '취소/환불' ? 'cancel-badge' : 'normal-badge'}">
              ${order.status}
            </span>
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="6" class="empty">최근 주문 내역이 없습니다.</td></tr>`;

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
    grid-template-columns:repeat(4,1fr);
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
    font-size:30px;
    font-weight:900;
    letter-spacing:-0.04em;
  }

  .card.cancel-card strong{
    color:#d93025;
  }

  .notice{
    margin:0 0 20px;
    padding:15px 17px;
    background:#fff7f1;
    border:1px solid #ffd6bd;
    border-radius:13px;
    color:#8a3a00;
    font-size:13px;
    line-height:1.6;
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
    min-width:980px;
  }

  th,td{
    padding:14px 12px;
    border-bottom:1px solid #eee;
    text-align:left;
    font-size:14px;
    vertical-align:middle;
  }

  th{
    background:#fafafa;
    color:#555;
    font-weight:900;
  }

  .amount{
    font-weight:800;
    color:#ff7a00;
  }

  .cancel{
    color:#d93025;
    font-weight:800;
  }

  .empty{
    text-align:center;
    color:#999;
  }

  .status{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:5px 9px;
    border-radius:999px;
    font-size:12px;
    font-weight:800;
    white-space:nowrap;
  }

  .normal-badge{
    background:#eef8f1;
    color:#16803c;
  }

  .cancel-badge{
    background:#fff0ef;
    color:#d93025;
  }

  .is-cancel td{
    color:#999;
    background:#fffafa;
  }

  @media(max-width:768px){
    .wrap{
      padding:28px 16px;
    }

    .head{
      flex-direction:column;
      align-items:flex-start;
    }

    h1{
      font-size:28px;
    }

    .refresh{
      width:100%;
      box-sizing:border-box;
    }

    .summary{
      grid-template-columns:1fr 1fr;
      gap:12px;
    }

    .card,.section{
      padding:18px;
      border-radius:14px;
    }

    .card strong{
      font-size:24px;
    }
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
        <span>정상 주문건수</span>
        <strong>${totalNormalOrderCount.toLocaleString('ko-KR')}건</strong>
      </div>
      <div class="card">
        <span>정상 매출</span>
        <strong>${won(totalNormalAmount)}</strong>
      </div>
      <div class="card cancel-card">
        <span>취소/환불 건수</span>
        <strong>${totalCancelOrderCount.toLocaleString('ko-KR')}건</strong>
      </div>
      <div class="card cancel-card">
        <span>취소/환불 금액</span>
        <strong>${won(totalCancelAmount)}</strong>
      </div>
    </div>

    <div class="notice">
      정상 매출은 품목 주문 API의 상태값 기준으로 취소/환불 주문을 제외한 금액입니다. 품목 주문 상태가 CANCEL, REFUND, RETURN 계열이면 취소/환불로 분류합니다.
    </div>

    <div class="section">
      <h2>고객사별 매출</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>고객사 ID</th>
              <th>고객사명</th>
              <th>정상 주문</th>
              <th>정상 매출</th>
              <th>취소/환불</th>
              <th>취소/환불 금액</th>
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
              <th>주문상품</th>
              <th>주문금액</th>
              <th>주문일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>${recentOrderRows}</tbody>
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
        <p>${String(err.message || '').replace(/</g, '&lt;')}</p>
      </div>
    `);
  }
}
