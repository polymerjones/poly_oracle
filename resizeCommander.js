const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const src = 'local/commander design';
const dst = 'www/commander';
fs.mkdirSync(dst, { recursive: true });
fs.readdirSync(src)
  .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
  .forEach(f => {
    sharp(path.join(src, f))
      .resize(64, 64, { fit: 'cover', position: 'top' })
      .jpeg({ quality: 88 })
      .toFile(path.join(dst, f.replace(/\.(jpg|png)$/, '.jpg')))
      .catch(e => console.error(f, e.message));
  });
