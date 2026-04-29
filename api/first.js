export default async function handler(req, res) {
  try {
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';

    const allowedDomains = [
      'fldup.com',
      'www.fldup.com',
      'seowaa.imweb.me',
      'fldup-api.vercel.app'
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

    const SUPPLY_CATEGORY_CODE = 's202604085049083083214';

    const API_KEY = (process.env.IMWEB_API_KEY || '').trim();
    const SECRET_KEY = (process.env.IMWEB_SECRET_KEY || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      throw new Error('Vercel 환경변수 IMWEB_API_KEY 또는 IMWEB_SECRET_KEY가 없습니다.');
    }

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
      throw new Error('아임웹 access token 발급 실패');
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

    async function apiGet(url) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'access-token': accessToken
        }
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`API JSON 파싱 실패: ${url}`);
      }

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} / ${url}`);
      }

      return data;
    }

async function fetchProducts() {
  const productMap = {};
  const LIMIT = 100;
  let offset = 0;

  while (true) {
    const url = `https://api.imweb.me/v2/shop/products?limit=${LIMIT}&offset=${offset}`;

    const data = await apiGet(url);

    const list =
      data?.data?.list ||
      data?.data?.products ||
      data?.list ||
      data?.products ||
      [];

    if (!Array.isArray(list) || list.length === 0) {
      break;
    }

    list.forEach(product => {
      if (product && product.no) {
        productMap[String(product.no)] = product;
      }
    });

    offset += LIMIT;

    // 안전장치 (무한루프 방지)
    if (offset > 2000) break;
  }

  return productMap;
}

    async function getProdOrderStatus(orderNo) {
      const url =
        `https://api.imweb.me/v2/shop/prod-orders` +
        `?order_no=${encodeURIComponent(orderNo)}` +
        `&order_version=v2`;

      const data = await apiGet(url);

      const statuses = [];
      const root = data?.data?.[orderNo];

      if (root && typeof root === 'object') {
        Object.values(root).forEach(prodOrder => {
          if (!prodOrder || typeof prodOrder !== 'object') return;

          const items = Array.isArray(prodOrder.items) ? prodOrder.items : [];

          statuses.push({
            prodOrderNo: prodOrder.order_no || '',
            status: prodOrder.status || '',
            itemNames: items.map(item => item.prod_name).filter(Boolean),
            items: items.map(item => ({
              prodNo: item.prod_no || '',
              prodName: item.prod_name || '',
              count: Number(item.payment?.count || 0),
              price: Number(item.payment?.price || 0),
              customCode: item.prod_custom_code || null
            }))
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

    function isSupplyItem(item, productMap) {
      const prodNo = String(item.prodNo || item.prod_no || '');
      const product = productMap[prodNo];

      if (!product) return false;

      const categories = Array.isArray(product.categories)
        ? product.categories
        : [];

      return categories.includes(SUPPLY_CATEGORY_CODE);
    }

    const productMap = await fetchProducts();

   let fromDate;
let toDate;

if (req.query.from && req.query.to) {
  fromDate = new Date(req.query.from + 'T00:00:00');
  toDate = new Date(req.query.to + 'T23:59:59');
} else {
  const now = new Date();
  fromDate = new Date();
  fromDate.setDate(now.getDate() - 30);
  toDate = now;
}

const orderDateFrom = Math.floor(fromDate.getTime() / 1000);
const orderDateTo = Math.floor(toDate.getTime() / 1000);

    const orderDateFrom = Math.floor(from.getTime() / 1000);
    const orderDateTo = Math.floor(now.getTime() / 1000);

    const ordersUrl =
      `https://api.imweb.me/v2/shop/orders` +
      `?order_date_from=${orderDateFrom}` +
      `&order_date_to=${orderDateTo}`;

    const ordersData = await apiGet(ordersUrl);

    const rawOrders =
      ordersData.data?.list ||
      ordersData.data?.orders ||
      ordersData.data ||
      ordersData.list ||
      ordersData.orders ||
      [];

    const orders = Array.isArray(rawOrders) ? rawOrders : [];

    const summaryMap = {};
    const orderRows = [];

    for (const order of orders) {
      const orderNo = order.order_no || order.order_code || '';
      const memberCode = order.orderer?.member_code || 'guest';
      const ordererName = order.orderer?.name || '비회원';
      const amount = Number(order.payment?.payment_amount || 0);

      let prodStatusInfo = {
        isCanceled: false,
        statuses: []
      };

      try {
        prodStatusInfo = await getProdOrderStatus(orderNo);
      } catch (e) {
        prodStatusInfo = {
          isCanceled: false,
          statuses: [],
          error: e.message
        };
      }

      const allItems = prodStatusInfo.statuses.flatMap(row => row.items || []);
      const supplyItems = allItems.filter(item => isSupplyItem(item, productMap));

      if (supplyItems.length === 0) {
        continue;
      }

      if (!summaryMap[memberCode]) {
        summaryMap[memberCode] = {
          memberId: order.orderer?.member_code || 'guest',
          displayName: ordererName,
          memberCode,
          normalOrderCount: 0,
          normalAmount: 0,
          cancelOrderCount: 0,
          cancelAmount: 0,
          totalOrderCount: 0
        };
      }

      const canceled = prodStatusInfo.isCanceled;

      summaryMap[memberCode].totalOrderCount += 1;

      if (canceled) {
        summaryMap[memberCode].cancelOrderCount += 1;
        summaryMap[memberCode].cancelAmount += amount;
      } else {
        summaryMap[memberCode].normalOrderCount += 1;
        summaryMap[memberCode].normalAmount += amount;
      }

      const productSummary = supplyItems
        .map(item => `${item.prodName} x ${item.count || 1}`)
        .join(', ') || '-';

      orderRows.push({
        orderNo,
        orderCode: order.order_code || '',
        name: ordererName,
        memberCode,
        amount,
        orderTime: Number(order.order_time || 0),
        status: canceled ? '취소/환불' : '정상',
        productSummary,
        detailItems: supplyItems
      });
    }

    const summary = Object.values(summaryMap);

    const totalNormalOrderCount = summary.reduce((sum, row) => sum + row.normalOrderCount, 0);
    const totalNormalAmount = summary.reduce((sum, row) => sum + row.normalAmount, 0);
    const totalCancelOrderCount = summary.reduce((sum, row) => sum + row.cancelOrderCount, 0);
    const totalCancelAmount = summary.reduce((sum, row) => sum + row.cancelAmount, 0);

    const memberRows = summary.length
      ? summary.map(row => `
        <tr>
          <td>${escapeHtml(row.memberCode)}</td>
          <td>${escapeHtml(row.displayName)}</td>
          <td>${row.normalOrderCount.toLocaleString('ko-KR')}건</td>
          <td class="amount">${won(row.normalAmount)}</td>
          <td class="cancel">${row.cancelOrderCount.toLocaleString('ko-KR')}건</td>
          <td class="cancel">${won(row.cancelAmount)}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="6" class="empty">부자재 주문 내역이 없습니다.</td></tr>`;

    const recentOrderRows = orderRows.length
      ? orderRows.map((order, index) => `
        <tr class="${order.status === '취소/환불' ? 'is-cancel' : ''}">
          <td>
            <button class="order-link" type="button" data-order-index="${index}">
              ${escapeHtml(order.orderNo)}
            </button>
          </td>
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
      : `<tr><td colspan="6" class="empty">최근 부자재 주문 내역이 없습니다.</td></tr>`;

    const orderDetailsJson = JSON.stringify(orderRows.map(order => ({
      orderNo: order.orderNo,
      name: order.name,
      amount: order.amount,
      status: order.status,
      items: order.detailItems
    }))).replace(/</g, '\\u003c');

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
    border:0;
    text-decoration:none;
    border-radius:10px;
    padding:14px 20px;
    font-size:14px;
    font-weight:800;
    cursor:pointer;
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

.date-filter{
  display:flex;
  gap:10px;
  margin:0 0 20px;
  align-items:center;
  flex-wrap:wrap;
}

.date-filter input{
  height:42px;
  padding:0 12px;
  border:1px solid #ddd;
  border-radius:8px;
  font-size:14px;
}

.date-filter button{
  height:42px;
  background:#ff7a00;
  color:#fff;
  border:0;
  padding:0 18px;
  border-radius:8px;
  font-size:14px;
  font-weight:800;
  cursor:pointer;
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

  .order-link{
    border:0;
    background:transparent;
    color:#ff7a00;
    font-weight:900;
    cursor:pointer;
    padding:0;
    text-decoration:underline;
    font-size:14px;
  }

  .modal-backdrop{
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.48);
    z-index:9999;
    align-items:center;
    justify-content:center;
    padding:20px;
  }

  .modal-backdrop.is-open{
    display:flex;
  }

  .modal{
    width:100%;
    max-width:560px;
    background:#fff;
    border-radius:18px;
    box-shadow:0 20px 60px rgba(0,0,0,.2);
    overflow:hidden;
  }

  .modal-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:20px 22px;
    border-bottom:1px solid #eee;
  }

  .modal-head h3{
    margin:0;
    font-size:20px;
    font-weight:900;
    letter-spacing:-0.04em;
  }

  .modal-close{
    border:0;
    background:#f5f5f5;
    border-radius:999px;
    width:34px;
    height:34px;
    cursor:pointer;
    font-weight:900;
  }

  .modal-body{
    padding:22px;
  }

  .modal-meta{
    margin:0 0 16px;
    color:#666;
    font-size:13px;
    line-height:1.6;
  }

  .modal-item{
    padding:14px 0;
    border-bottom:1px solid #eee;
  }

  .modal-item:last-child{
    border-bottom:0;
  }

  .modal-item strong{
    display:block;
    font-size:15px;
    margin-bottom:6px;
  }

  .modal-item span{
    color:#666;
    font-size:13px;
  }

  @media(max-width:768px){
    .wrap{ padding:28px 16px; }
    .head{ flex-direction:column; align-items:flex-start; }
    h1{ font-size:28px; }
    .refresh{ width:100%; box-sizing:border-box; }
    .summary{ grid-template-columns:1fr 1fr; gap:12px; }
    .card,.section{ padding:18px; border-radius:14px; }
    .card strong{ font-size:24px; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">FIELDUP PARTNER SALES</p>
        <h1>부자재 매출 확인</h1>
        <p class="desc">부자재 카테고리 주문 건수와 매출을 확인할 수 있습니다.</p>
      </div>
      <button class="refresh" type="button" onclick="window.location.reload()">새로고침</button>
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

    <div class="date-filter">
  <input type="date" id="fromDate" value="${escapeHtml(req.query.from || '')}">
  <span>~</span>
  <input type="date" id="toDate" value="${escapeHtml(req.query.to || '')}">
  <button type="button" onclick="applyFilter()">조회</button>
</div>

    <div class="notice">
      현재 부자재 집계 기준 카테고리 코드는 <strong>${SUPPLY_CATEGORY_CODE}</strong>입니다.
      정상 매출은 품목 주문 상태가 CANCEL, REFUND, RETURN 계열인 주문을 제외한 금액입니다.
    </div>

    <div class="section">
      <h2>고객사별 매출</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>회원코드</th>
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

  <div class="modal-backdrop" id="orderModal">
    <div class="modal">
      <div class="modal-head">
        <h3 id="modalTitle">주문 상세</h3>
        <button class="modal-close" type="button" id="modalClose">×</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

<script>
  const ORDER_DETAILS = ${orderDetailsJson};

function applyFilter(){
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  if(!from || !to){
    alert('기간을 선택해주세요.');
    return;
  }

  window.location.href = '/api/first?from=' + from + '&to=' + to;
}

  function won(num){
    return Number(num || 0).toLocaleString('ko-KR') + '원';
  }

  const modal = document.getElementById('orderModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');

  document.querySelectorAll('.order-link').forEach(function(btn){
    btn.addEventListener('click', function(){
      const index = Number(btn.getAttribute('data-order-index'));
      const order = ORDER_DETAILS[index];

      if(!order) return;

      modalTitle.textContent = '주문 상세 - ' + order.orderNo;

      let html = '<p class="modal-meta">' +
        '고객명: ' + order.name + '<br>' +
        '주문상태: ' + order.status + '<br>' +
        '주문금액: ' + won(order.amount) +
      '</p>';

      if(!order.items || order.items.length === 0){
        html += '<p>표시할 상품이 없습니다.</p>';
      }else{
        order.items.forEach(function(item){
          html += '<div class="modal-item">' +
            '<strong>' + item.prodName + '</strong>' +
            '<span>수량: ' + (item.count || 1) + '개 / 금액: ' + won(item.price || 0) + '</span>' +
          '</div>';
        });
      }

      modalBody.innerHTML = html;
      modal.classList.add('is-open');
    });
  });

  modalClose.addEventListener('click', function(){
    modal.classList.remove('is-open');
  });

  modal.addEventListener('click', function(e){
    if(e.target === modal){
      modal.classList.remove('is-open');
    }
  });
</script>
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
