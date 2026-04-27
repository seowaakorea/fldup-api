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

    async function requestTokenByGet() {
      const tokenUrl =
        `https://api.imweb.me/v2/auth?key=${encodeURIComponent(API_KEY)}&secret=${encodeURIComponent(SECRET_KEY)}`;

      const response = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json().catch(() => ({}));

      return {
        method: 'GET_QUERY',
        status: response.status,
        data
      };
    }

    async function requestTokenByPostJson() {
      const response = await fetch('https://api.imweb.me/v2/auth', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: API_KEY,
          secret: SECRET_KEY
        })
      });

      const data = await response.json().catch(() => ({}));

      return {
        method: 'POST_JSON',
        status: response.status,
        data
      };
    }

    async function requestTokenByPostForm() {
      const body = new URLSearchParams();
      body.append('key', API_KEY);
      body.append('secret', SECRET_KEY);

      const response = await fetch('https://api.imweb.me/v2/auth', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: body.toString()
      });

      const data = await response.json().catch(() => ({}));

      return {
        method: 'POST_FORM',
        status: response.status,
        data
      };
    }

    function extractAccessToken(data) {
      return (
        data.access_token ||
        data.accessToken ||
        data.token ||
        data.data?.access_token ||
        data.data?.accessToken ||
        data.data?.token ||
        ''
      );
    }

    const attempts = [];

    const getAttempt = await requestTokenByGet();
    attempts.push(getAttempt);

    let accessToken = extractAccessToken(getAttempt.data);
    let successMethod = getAttempt.method;

    if (!accessToken) {
      const postJsonAttempt = await requestTokenByPostJson();
      attempts.push(postJsonAttempt);
      accessToken = extractAccessToken(postJsonAttempt.data);
      successMethod = postJsonAttempt.method;
    }

    if (!accessToken) {
      const postFormAttempt = await requestTokenByPostForm();
      attempts.push(postFormAttempt);
      accessToken = extractAccessToken(postFormAttempt.data);
      successMethod = postFormAttempt.method;
    }

    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        message: '아임웹 access token 발급 실패',
        hint: '키/시크릿이 맞는데도 실패하면 API 사용 권한 또는 사이트 선택을 다시 확인해야 합니다.',
        keyLength: API_KEY.length,
        secretLength: SECRET_KEY.length,
        attempts
      });
    }

    return res.status(200).json({
      ok: true,
      message: '아임웹 access token 발급 성공',
      method: successMethod,
      tokenPreview: accessToken.slice(0, 8) + '...',
      keyLength: API_KEY.length,
      secretLength: SECRET_KEY.length
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: '토큰 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}
