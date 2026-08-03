import bcrypt from 'bcryptjs';

const password = 'admin123';
const hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gXyXyQyW5qy';

bcrypt.compare(password, hash).then((result) => {
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('Match:', result);
});
