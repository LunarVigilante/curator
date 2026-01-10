
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

console.log('Sharp imported via require successfully');
try {
    sharp({
        create: {
            width: 10,
            height: 10,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
    }).toBuffer().then(buffer => {
        console.log('Sharp processed image, length:', buffer.length);
    });
} catch (e) {
    console.error('Sharp error:', e);
}
