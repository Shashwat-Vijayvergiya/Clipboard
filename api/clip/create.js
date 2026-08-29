const { saveClip, generateUniqueCode } = require('../../lib/storage');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { type, content, language, fileName, fileSize, fileUrl, expiresInMinutes = 5 } = req.body || {};
    
    const validMinutes = [1, 5, 10].includes(Number(expiresInMinutes)) ? Number(expiresInMinutes) : 5;
    const ttlSeconds = validMinutes * 60;
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);
    const code = await generateUniqueCode();

    const clip = {
      code,
      type: type || 'text',
      content: content || '',
      language: language || (type === 'code' ? 'javascript' : null),
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileUrl: fileUrl || null,
      createdAt: now,
      expiresInMinutes: validMinutes,
      expiresAt
    };

    await saveClip(code, clip, ttlSeconds);

    return res.status(200).json({
      success: true,
      code,
      clip
    });
  } catch (error) {
    console.error('Error creating clip:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};
