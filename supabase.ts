import { createClient } from '@supabase/supabase-js'

/*
Technically we have RLS for anyone with the supabaseKey in the env file
Better practice is to upsert from backend but this is fine for now
*/

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
