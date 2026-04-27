export default async function handler(req, res) {
  try {
    const API_KEY = (process.env.IMWEB_API_KEY || '').trim();
    const SECRET_KEY = (process.env.IMWEB_SECRET_KEY || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        message: '환경변수 IMWEB_API_KEY 또는 IMWEB_SECRET_KEY가 없습니다.'
      });
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
      return res.status(401).json({
        ok: false,
        message: '아임웹 access token 발급 실패',
        raw: tokenData
      });
    }

    const targetOrderNo = '202604277420970';

    async function fetchJson(url) {
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
        data = {
          parseError: true,
          text
        };
      }

      return {
        url,
        status: response.status,
        ok: response.ok,
        data
      };
    }

    const urlsToTry = [
      // 여러 품목 주문 목록 조회: order_no 파라미터
      `https://api.imweb.me/v2/shop/prod-orders?order_no=${encodeURIComponent(targetOrderNo)}&order_version=v2`,

      // v1도 같이 확인
      `https://api.imweb.me/v2/shop/prod-orders?order_no=${encodeURIComponent(targetOrderNo)}&order_version=v1`,

      // 주문 상세 조회 가능성 확인
      `https://api.imweb.me/v2/shop/orders/${encodeURIComponent(targetOrderNo)}`,

      // 혹시 order_code가 필요한 경우가 있어서 기존 취소 테스트 주문의 order_code도 같이 확인
      `https://api.imweb.me/v2/shop/orders/o20260427b59874868d1a6`
    ];

    const results = [];

    for (const url of urlsToTry) {
      const result = await fetchJson(url);
      results.push(result);
    }

    function summarizeProdOrders(data) {
      const raw =
        data?.data?.list ||
        data?.data?.prod_orders ||
        data?.data?.prodOrders ||
        data?.data ||
        data?.list ||
        data?.prod_orders ||
        data?.prodOrders ||
        [];

      const rows = Array.isArray(raw) ? raw : [];

      return rows.map(row => ({
        order_no: row.order_no || row.orderNo || '',
        prod_order_no: row.prod_order_no || row.prodOrderNo || row.order_no || '',
        status: row.status || '',
        claim_status: row.claim_status || row.claimStatus || '',
        claim_type: row.claim_type || row.claimType || '',
        pay_time: row.pay_time || row.payTime || '',
        delivery_time: row.delivery_time || row.deliveryTime || '',
        complete_time: row.complete_time || row.completeTime || '',
        keys: Object.keys(row || {}),
        raw: row
      }));
    }

    return res.status(200).json({
      ok: true,
      mode: 'prod_order_cancel_debug',
      targetOrderNo,
      message: '취소 주문 자동 판별을 위한 품목 주문/주문 상세 진단 결과입니다.',
      results: results.map(result => ({
        url: result.url,
        status: result.status,
        ok: result.ok,
        topLevelKeys: result.data ? Object.keys(result.data) : [],
        summarizedProdOrders: summarizeProdOrders(result.data),
        raw: result.data
      }))
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: '품목 주문 진단 중 오류가 발생했습니다.',
      error: err.message
    });
  }
}
