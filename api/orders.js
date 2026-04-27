export default function handler(req, res) {
  res.status(200).json({
    message: "FLDUP API 정상 작동",
    time: new Date().toISOString()
  });
}
