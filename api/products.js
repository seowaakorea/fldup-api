export default async function handler(req, res) {
  try {
    const API_KEY = process.env.IMWEB_API_KEY;
    const SECRET_KEY = process.env.IMWEB_SECRET_KEY;

    const tokenRes = await fetch(
      `https://api.imweb.me/v2/auth?key=${API_KEY}&secret=${SECRET_KEY}`
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const productRes = await fetch(
      `https://api.imweb.me/v2/shop/products?limit=50`,
      {
        headers: {
          'access-token': accessToken
        }
      }
    );

    const productData = await productRes.json();

    return res.status(200).json({
      ok: true,
      sample: productData.data
    });

  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}
