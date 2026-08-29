const { getClip, deleteClip } = require('../../lib/storage');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query || {};

  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing 4-digit code' });
  }

  if (req.method === 'GET') {
    try {
      const clip = await getClip(code);

      if (!clip) {
        return res.status(404).json({ success: false, error: 'Clip not found or has expired.' });
      }

      if (clip.expiresAt && clip.expiresAt <= Date.now()) {
        await deleteClip(code);
        return res.status(404).json({ success: false, error: 'Clip has expired.' });
      }

      return res.status(200).json({ success: true, clip });
    } catch (error) {
      console.error('Error fetching clip:', error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteClip(code);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
