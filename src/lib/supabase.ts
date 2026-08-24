import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

let client: SupabaseClient | null = null

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
)

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Supabase 설정이 없습니다. .env.local의 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 확인하세요.',
    )
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey)
  }

  return client
}
