
import sharp from 'sharp';
console.log('Sharp imported successfully');
try {
    const buffer = await sharp({
        create: {
            width: 10,
            height: 10,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
    }).toBuffer();
    console.log('Sharp processed image, length:', buffer.length);
} catch (e) {
    console.error('Sharp error:', e);
}
