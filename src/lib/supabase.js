import { createClient } from '@supabase/supabase-js'

// Point at a local Supabase while developing by setting these in .env.local
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://mbbloxmliuoaplsnjlhv.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYmxveG1saXVvYXBsc25qbGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODYxNjcsImV4cCI6MjEwNTU2MjE2N30.Ik3hFHre0UfJqmet-fiI_U-Oemy7gDUtYBjN1Z35t-g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Throws on error so callers can use try/catch or useAsync
export async function must(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}
