
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    console.log('🔍 Checking schema...')

    // Try to select description_length from one item
    const { data, error } = await supabase
        .from('global_items')
        .select('description_length')
        .limit(1)

    if (error) {
        console.error('❌ Check Failed:', error)
        console.log('Attempting to fix by creating the computed column function...')

        // SQL to create the function
        const sql = `
        create or replace function description_length(global_items_row global_items)
        returns integer as $$
          select char_length(coalesce(global_items_row.description, ''));
        $$ language sql stable;
        `

        const { error: rpcError } = await supabase.rpc('execute_sql_literal', { sql_query: sql })
        // Note: execute_sql_literal might not exist unless I added it. 
        // Standard RPC can't exec raw SQL unless a helper exists.
        // Assuming we might fail here if no helper.

        if (rpcError) {
            console.error('❌ Failed to run RPC:', rpcError)
            // Try assuming the error was just "column not found" and we rely on user running migration manually if we can't do it here.
        } else {
            console.log('✅ Function created (maybe? RPC returned success/null)')
        }
    } else {
        console.log('✅ description_length column (or computed) exists!')
    }
}

checkSchema()
