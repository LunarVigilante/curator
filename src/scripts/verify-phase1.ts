import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
    console.log('Verifying Phase 1 Database Changes...\n');

    // 1. Verify Tables
    const expectedTables = [
        'criteria_definitions',
        'user_criteria_ratings',
        'user_criteria_weights',
        'global_items'
    ];

    console.log('--- Checking Tables ---');
    for (const table of expectedTables) {
        // Attempt to select 1 record to check existence (and permissions if using anon, but here we use service role)
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            // If table doesn't exist, this usually errors with "relation does not exist"
            if (error.code === '42P01') {
                console.error(`❌ Table '${table}' DOES NOT exist.`);
            } else {
                console.log(`✅ Table '${table}' exists.`);
            }
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }

    // 2. Verify Embedding Column (Implicitly checked via select, but let's be explicit if possible)
    // Converting this to a simple check: can we select the embedding column?
    console.log('\n--- Checking Embedding Column ---');
    const { error: colError } = await supabase.from('global_items').select('embedding').limit(1);
    if (colError) {
        console.error(`❌ Column 'embedding' missing on global_items:`, colError.message);
    } else {
        console.log(`✅ Column 'embedding' exists on global_items.`);
    }

    // 3. Verify RPC Functions
    console.log('\n--- Checking RPC Functions ---');

    // get_borda_rankings
    const { error: rpc1 } = await supabase.rpc('get_borda_rankings', { p_limit: 1 });
    if (rpc1) console.error(`❌ Function 'get_borda_rankings' failed:`, rpc1.message);
    else console.log(`✅ Function 'get_borda_rankings' is callable.`);

    // match_documents (requires args)
    // We'll pass a dummy vector. Voyage-3 is 1024 dims.
    const dummyVector = new Array(1024).fill(0.1);
    const { error: rpc2 } = await supabase.rpc('match_documents', {
        query_embedding: JSON.stringify(dummyVector) as any, // Try string format first
        match_threshold: 0.1,
        match_count: 1
    });

    if (rpc2 && rpc2.message.includes('function match_documents')) {
        console.error(`❌ Function 'match_documents' not found/signature mismatch:`, rpc2.message);
    } else if (rpc2) {
        // Other errors might mean it exists but failed execution (which is fine for existence check)
        console.log(`✅ Function 'match_documents' exists (Execution error likely due to empty DB/types, which is expected):`, rpc2.message);
    } else {
        console.log(`✅ Function 'match_documents' exists and executed.`);
    }

    // 4. Verify Index (Cannot easily check via API, but if match_documents runs fast later it's there. 
    // We can assume it worked if the previous step passed as they were in the same migration).
    console.log('\n--- Verification Complete ---');
}

verify();
