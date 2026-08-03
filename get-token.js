// 生成测试用 JWT token
const secret = 'fe9a4e7491d09fe151fb181179a7d6cc751a40d8de234a75af5c80153f48037cd82e30a81462cf42c3af1b6a00d79490ae133757799f0b10bd45611b867c33a7';

// HS256 JWT 手动生成
function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  userId: 'cf08328b-4c45-4b36-a4a8-19fd6779b890',
  email: 'admin@dunhuang.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
};

const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload));

// 使用 HMAC-SHA256 签名（Node.js crypto）
const crypto = require('crypto');
const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const token = unsigned + '.' + signature;
console.log(token);
