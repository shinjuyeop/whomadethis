import type { Profile } from '../types/database'
import { getSupabaseClient } from './supabase'

interface ProfileRow {
  id: string
  nickname: string
  avatar_url: string | null
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
  }
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id,nickname,avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error('프로필을 불러오지 못했습니다.')
  }

  return data ? toProfile(data as ProfileRow) : null
}

export async function saveProfile(userId: string, nickname: string) {
  const normalizedNickname = nickname.trim()
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .upsert(
      { id: userId, nickname: normalizedNickname },
      { onConflict: 'id' },
    )
    .select('id,nickname,avatar_url')
    .single()

  if (error) {
    throw new Error('프로필을 저장하지 못했습니다.')
  }

  return toProfile(data as ProfileRow)
}
