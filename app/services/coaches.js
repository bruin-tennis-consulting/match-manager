// lib/coaches.ts
import { supabase } from '../../supabase'

// create new coach entry if they don't exist, or return existing one if they do
// runs every login, but idempotent due to upsert with onConflict: 'firebase_uid'
export async function upsertCoach(firebaseUser) {
  const { data, error } = await supabase
    .from('coaches')
    .upsert(
      {
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email,
        display_name: firebaseUser.displayName
      },
      { onConflict: 'firebase_uid' } // no-op if they already exist
    )
    .select()
    .single()

  if (error) throw error
  return data // your coaches row, with the Supabase UUID
}

export async function getCoach(firebaseUid) {
  const { data } = await supabase
    .from('coaches')
    .select('id, display_name, email')
    .eq('firebase_uid', firebaseUid)
    .single()

  return data // use data.id as coach_id in other tables
}
