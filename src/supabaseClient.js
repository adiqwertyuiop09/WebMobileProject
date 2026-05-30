import { createClient } from '@supabase/supabase-js'

// pulls the clean URL and Key you just fixed in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// This initializes the connection 
export const supabase = createClient(supabaseUrl, supabaseAnonKey)