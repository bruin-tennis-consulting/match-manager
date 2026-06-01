import { NextResponse } from 'next/server'
import { supabase } from '@/supabase'

export async function GET() {
  const querySelect = `
      id,
      full_name,
      first_name,
      last_name,
      gender,
      country_code,
      grad_year,
      region,
      academy,
      image_url,
      video_urls,
      player_rankings (
        source,
        ranking,
        rank_value,
        ranking_date,
        points,
        singles_points,
        doubles_points,
        bonus_points,
        age_division,
        section,
        district,
        state,
        city,
        three_month_rating,
        trend_direction,
        high_school,
        high_school_state,
        scraped_tag,
        committed_to,
        stars,
        ranking_type
      ),
      matches!matches_player_id_fkey (
        id,
        opponent_id,
        winner_id,
        tournament_id,
        outcome,
        score,
        round,
        best_of,
        status,
        source,
        played_at,
        opponent:opponent_id (
          id,
          full_name
        ),
        tournament:tournament_id (
          id,
          name
        )
      )
    `

  let players = []
  let hasMore = true
  let from = 0
  const limit = 1000

  while (hasMore) {
    const { data, error } = await supabase
      .schema('canonical')
      .from('players')
      .select(querySelect)
      .order('full_name')
      .range(from, from + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data) {
      players = players.concat(data)
      if (data.length < limit) {
        hasMore = false
      } else {
        from += limit
      }
    } else {
      hasMore = false
    }
  }

  const result = players
    .filter((p) => (p.player_rankings || []).length > 0)
    .map((p) => {
      // rankings table
      const rankings = p.player_rankings || []

      const latest = (source) =>
        rankings
          .filter((r) => r.source === source)
          .sort((a, b) => b.ranking_date.localeCompare(a.ranking_date))[0]

      // Prefer the CRL row (main TR national rank) over homepage / cross-source rows
      const latestTR = () => {
        const trAll = rankings.filter(
          (r) => r.source === 'tennisrecruiting.net'
        )
        const crl = trAll.filter(
          (r) => r.ranking_type === 'tennisrecruiting_crl'
        )
        const base = crl.length > 0 ? crl : trAll
        return base.sort((a, b) =>
          b.ranking_date.localeCompare(a.ranking_date)
        )[0]
      }

      const usta = latest('USTA')
      const utr = latest('UTR')
      const tr = latestTR()

      // matches table
      const matches = p.matches || []

      const recentMatches = matches
        .filter((m) => m.played_at)
        .sort((a, b) => b.played_at.localeCompare(a.played_at))
        .slice(0, 10)
        .map((m) => ({
          id: m.id,
          played_at: m.played_at,
          outcome: m.outcome,
          score: m.score,
          round: m.round,
          best_of: m.best_of,
          status: m.status,
          source: m.source,
          winner_id: m.winner_id,
          opponent: m.opponent
            ? {
                id: m.opponent.id,
                full_name: m.opponent.full_name
              }
            : null,
          tournament: m.tournament
            ? {
                id: m.tournament.id,
                name: m.tournament.name
              }
            : null
        }))

      return {
        id: p.id,
        full_name: p.full_name,
        first_name: p.first_name,
        last_name: p.last_name,
        gender: p.gender,
        country_code: p.country_code,
        grad_year: p.grad_year,
        region: p.region,
        academy: p.academy ?? null,
        image_url: p.image_url ?? null,
        video_urls: p.video_urls ?? null,
        // USTA
        usta_rank: usta?.ranking ?? null,
        usta_points: usta?.points ?? null,
        usta_singles: usta?.singles_points ?? null,
        usta_doubles: usta?.doubles_points ?? null,
        usta_bonus: usta?.bonus_points ?? null,
        usta_age_division: usta?.age_division ?? null,
        usta_section: usta?.section ?? null,
        usta_district: usta?.district ?? null,
        usta_state: usta?.state ?? null,
        usta_city: usta?.city ?? null,
        // UTR
        utr_rating: utr?.rank_value ?? null,
        utr_ranking: utr?.ranking ?? null,
        utr_three_month: utr?.three_month_rating ?? null,
        utr_trend: utr?.trend_direction ?? null,
        utr_high_school: utr?.high_school ?? null,
        utr_high_school_state: utr?.high_school_state ?? null,
        utr_scraped_tag: utr?.scraped_tag ?? null,
        // TennisRecruiting
        tr_rank: tr?.ranking ?? null,
        tr_stars: tr?.stars ?? null,
        tr_committed_to: tr?.committed_to ?? null,
        tr_state: tr?.state ?? null,
        tr_city: tr?.city ?? null,
        // Recent matches
        recent_matches: recentMatches
      }
    })

  result.sort((a, b) => {
    if (a.usta_rank !== null && b.usta_rank !== null)
      return a.usta_rank - b.usta_rank
    if (a.usta_rank !== null) return -1
    if (b.usta_rank !== null) return 1
    return (a.full_name || '').localeCompare(b.full_name || '')
  })

  return NextResponse.json(result)
}
