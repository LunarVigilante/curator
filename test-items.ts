import { getItems } from './src/lib/actions/items';

async function test() {
    console.log('Testing getItems...');
    try {
        const items = await getItems();
        console.log('Success! Found items:', items.length);
        if (items.length > 0) {
            console.log('First item:', items[0]);
        }
    } catch (error) {
        console.error('Error calling getItems:', error);
    }
}

test().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
