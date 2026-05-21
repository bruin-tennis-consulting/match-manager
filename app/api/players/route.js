import { NextResponse } from 'next/server'
import { supabase } from '@/supabase'

export async function GET() {
  const { data: players, error } = await supabase
    .from('players')
    .select(
      `
      id,
      full_name,
      first_name,
      last_name,
      gender,
      country_code,
      grad_year,
      region,
      player_rankings (
        source,
        ranking,
        ranking_date,
        raw_data
      )
    `
    )
    .order('full_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = players.map((p) => {
    const rankings = p.player_rankings || []

    const usta = rankings
      .filter((r) => r.source === 'USTA')
      .sort((a, b) => b.ranking_date.localeCompare(a.ranking_date))[0]

    const utr = rankings
      .filter((r) => r.source === 'UTR')
      .sort((a, b) => b.ranking_date.localeCompare(a.ranking_date))[0]

    return {
      id: p.id,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      gender: p.gender,
      country_code: p.country_code,
      grad_year: p.grad_year,
      region: p.region,
      // USTA
      usta_rank: usta?.ranking ?? null,
      usta_points: usta?.raw_data?.usta_points ?? null,
      usta_singles: usta?.raw_data?.singles_points ?? null,
      usta_doubles: usta?.raw_data?.doubles_points ?? null,
      usta_bonus: usta?.raw_data?.bonus_points ?? null,
      usta_age_division: usta?.raw_data?.age_division ?? null,
      usta_section: usta?.raw_data?.section ?? null,
      usta_district: usta?.raw_data?.district ?? null,
      usta_state: usta?.raw_data?.state ?? null,
      usta_city: usta?.raw_data?.city ?? null,
      // UTR
      utr_rating: utr?.raw_data?.utr_rating ?? null,
      utr_ranking: utr?.ranking ?? null,
      utr_three_month: utr?.raw_data?.three_month_rating ?? null,
      utr_trend: utr?.raw_data?.trend_direction ?? null,
      utr_high_school: utr?.raw_data?.high_school ?? null,
      utr_high_school_state: utr?.raw_data?.high_school_state ?? null,
      utr_scraped_tag: utr?.raw_data?.scraped_tag ?? null
    }
  })

  // Sort: USTA-ranked players first (by rank asc), then rest alphabetically
  result.sort((a, b) => {
    if (a.usta_rank !== null && b.usta_rank !== null)
      return a.usta_rank - b.usta_rank
    if (a.usta_rank !== null) return -1
    if (b.usta_rank !== null) return 1
    return (a.full_name || '').localeCompare(b.full_name || '')
  })

  return NextResponse.json(result)
}
