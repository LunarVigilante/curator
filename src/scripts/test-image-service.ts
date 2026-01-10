
import 'dotenv/config';
import { ImageService } from '@/lib/services/image/imageService';

async function test() {
    console.log('Importing ImageService...');
    const service = new ImageService();
    console.log('Instantiated service.');
}

test().catch(console.error);
