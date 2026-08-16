export async function me(req, res) {
  res.json({ user: req.user });
}
