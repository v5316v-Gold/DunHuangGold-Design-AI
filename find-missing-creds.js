const fs = require('fs');
const path = require('path');

const hooksDir = 'C:/Users/v5316/.openclaw/workspace/image-gen-components/src/hooks';
const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.ts'));

let issues = [];
files.forEach(file => {
  const c = fs.readFileSync(path.join(hooksDir, file), 'utf8');
  // Find all fetch calls
  const lines = c.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes("fetch('") || line.includes('fetch("')) {
      // Check if this fetch block has credentials
      const blockStart = idx;
      const blockEnd = Math.min(idx + 10, lines.length);
      const block = lines.slice(blockStart, blockEnd).join('\n');
      if (!block.includes('credentials')) {
        issues.push(`${file}:${idx + 1} - ${line.trim().substring(0, 80)}`);
      }
    }
  });
});

if (issues.length > 0) {
  console.log('fetch calls WITHOUT credentials:');
  issues.forEach(i => console.log(' ', i));
} else {
  console.log('All fetch calls have credentials:include');
}
