import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://mbbloxmliuoaplsnjlhv.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYmxveG1saXVvYXBsc25qbGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODYxNjcsImV4cCI6MjEwNTU2MjE2N30.Ik3hFHre0UfJqmet-fiI_U-Oemy7gDUtYBjN1Z35t-g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
