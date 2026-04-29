export default async function handler(req, res) {
  try {
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
      'https://api.imweb.me/v2/member/members',
      'https://api.imweb.me/v2/member/members?limit=100',
      'https://api.imweb.me/v2/member/members?offset=0&limit=100'
    ];

    const results = [];

    for (const url of urlsToTry) {
      const result = await fetchJson(url);
      results.push(result);
    }

    function extractMembers(data) {
      const raw =
        data?.data?.list ||
        data?.data?.members ||
        data?.data?.member_list ||
        data?.data ||
        data?.list ||
        data?.members ||
        [];

      if (Array.isArray(raw)) return raw;

      if (raw && typeof raw === 'object') {
        const values = Object.values(raw);
        if (values.every(item => item && typeof item === 'object')) {
          return values;
        }
      }

      return [];
    }

    function summarizeMember(member) {
      return {
        keys: Object.keys(member || {}),

        memberCode:
          member.member_code ||
          member.memberCode ||
          member.code ||
          member.idx ||
          member.no ||
          '',

        memberId:
          member.member_id ||
          member.memberId ||
          member.user_id ||
          member.userId ||
          member.id ||
          '',

        name:
          member.name ||
          member.member_name ||
          member.memberName ||
          member.nickname ||
          '',

        email:
          member.email ||
          member.member_email ||
          '',

        phone:
          member.call ||
          member.phone ||
          member.mobile ||
          member.tel ||
          '',

        group:
          member.group ||
          member.groups ||
          member.group_list ||
          member.groupList ||
          member.member_group ||
          member.memberGroup ||
          member.member_groups ||
          member.memberGroups ||
          member.grade ||
          member.level ||
          member.group_name ||
          member.groupName ||
          null,

        raw: member
      };
    }

    const summarizedResults = results.map(result => {
      const members = extractMembers(result.data);

      return {
        url: result.url,
        status: result.status,
        ok: result.ok,
        topLevelKeys: result.data ? Object.keys(result.data) : [],
        memberCount: members.length,
        sampleMembers: members.slice(0, 20).map(summarizeMember),
        rawPreview: result.data
      };
    });

    return res.status(200).json({
      ok: true,
      mode: 'member_group_debug',
      message: '아임웹 회원 API 그룹 필드 확인용 응답입니다.',
      results: summarizedResults
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: '회원 API 진단 중 오류가 발생했습니다.',
      error: err.message
    });
  }
}
