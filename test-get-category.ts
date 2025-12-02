import { getCategory } from './src/lib/actions/categories';

async function test() {
    console.log('Testing getCategory...');
    const testId = 'b6f92236-4dde-424a-9737-2650228e3700';

    try {
        const category = await getCategory(testId);
        console.log('Result:', category);

        if (!category) {
            console.log('Category not found!');
        } else {
            console.log('Category found:', category.name);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

test().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
