import { getCategories } from './src/lib/actions/categories';

async function test() {
    console.log('Testing getCategories...');
    try {
        const categories = await getCategories();
        console.log('Success! Found categories:', categories.length);
        if (categories.length > 0) {
            console.log('First category:', categories[0]);
        }
    } catch (error) {
        console.error('Error calling getCategories:', error);
    }
}

test().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
