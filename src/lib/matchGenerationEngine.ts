import { supabase } from './supabaseClient'
import type { Database } from '../types/supabase'
import type { TournamentSettings, TournamentFormat } from '../types/tournament'
import { validateSettingsForFormat } from '../types/tournament'
import { getTournamentStandings } from './matchService'
import {
  canAdvanceFromSemifinalsToFinal,
  extractSemifinalWinnersForFinal,
  type KnockoutMatchCore,
} from './playoffKnockout'

type Match = Database['public']['Tables']['matches']['Insert']

/** Rodadas da fase de pontos corridos no formato campeonato (igual ao UI). */
export function campeonatoLeagueRoundCount(participantCount: number, hasReturnMatch: boolean): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

/**
 * ============================================
 * TOURNAMENT MATCH GENERATION ENGINE
 * ============================================
 */

/**
 * Gera all matches para um torneio baseado no formato escolhido
 */
export async function generateMatchesByFormat(
  tournamentId: string,
  format: TournamentFormat,
  settings: TournamentSettings
): Promise<void> {
  // 1. Buscar torneio e validar
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error('Torneio não encontrado')
  }

  // 2. Buscar participantes
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id')
    .eq('tournament_id', tournamentId)

  if (participantsError || !participants || participants.length === 0) {
    throw new Error('Nenhum participante encontrado')
  }

  // 3. Validar formato para quantidade de participantes
  const validation = validateSettingsForFormat(format, participants.length)
  if (!validation.valid) {
    throw new Error(validation.error || 'Formato inválido para este número de participantes')
  }

  const participantIds = participants.map((p) => p.id)

  // 4. Gerar matches baseado no formato
  let matches: Match[] = []

  switch (format) {
    case 'roundRobin':
      matches = generateRoundRobinMatches(participantIds, settings.hasReturnMatch || false)
      break
    case 'knockout':
      matches = generateKnockoutMatches(participantIds, settings.hasReturnMatch || false)
      break
    case 'groupsCrossed':
      matches = generateGroupsCrossedMatches(
        participantIds,
        settings.bracketGroups || 2,
        settings.hasReturnMatch || false
      )
      break
    case 'mixed':
      matches = generateMixedMatches(
        participantIds,
        settings.qualifiedCount || 2,
        settings.bracketGroups || 2,
        settings.hasReturnMatch || false
      )
      break
    case 'campeonato':
      matches = generateRoundRobinMatches(participantIds, settings.hasReturnMatch || false)
      break
    default:
      throw new Error(`Formato desconhecido: ${format}`)
  }

  // 5. Inserir matches no banco
  if (matches.length === 0) {
    throw new Error('Nenhuma partida foi gerada')
  }

  const matchesWithTournament = matches.map((m) => ({
    ...m,
    tournament_id: tournamentId,
  }))

  const { error: insertError } = await supabase.from('matches').insert(matchesWithTournament)

  if (insertError) {
    console.error('Erro ao inserir partidas:', insertError.message)
    throw new Error(`Falha ao inserir partidas: ${insertError.message}`)
  }

  // 6. Atualizar status do torneio para 'active'
  // Mesclar com settings existentes para preservar isPrivate e maxParticipants
  const existingSettings = tournament.settings as Partial<TournamentSettings> | null
  const formatSettings = JSON.parse(JSON.stringify(settings)) as Partial<TournamentSettings>
  const mergedSettings = {
    ...(existingSettings ?? {}),
    ...formatSettings,
    // Modal de formato não altera quem lança placar — preservar sempre do torneio
    adminScores: existingSettings?.adminScores ?? true,
    scoreValidation: existingSettings?.scoreValidation ?? false,
  }

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      status: 'active',
      settings: mergedSettings,
    })
    .eq('id', tournamentId)

  if (updateError) {
    console.error('Erro ao atualizar torneio:', updateError.message)
    throw new Error(`Falha ao atualizar torneio: ${updateError.message}`)
  }
}

/**
 * ============================================
 * FORMAT: ROUND ROBIN (Pontos Corridos)
 * ============================================
 * Todos vs todos. Com opção de turno e returno.
 */
function getRoundRobinRoundCount(participantCount: number): number {
  if (participantCount <= 1) return 0
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount
}

function generateRoundRobinMatches(participantIds: string[], hasReturnMatch: boolean): Match[] {
  if (participantIds.length < 2) return []

  const matches: Match[] = []
  const rotation: Array<string | null> = [...participantIds]

  if (rotation.length % 2 !== 0) {
    rotation.push(null)
  }

  const totalRounds = getRoundRobinRoundCount(participantIds.length)
  const matchesPerRound = rotation.length / 2

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex++) {
      const home = rotation[matchIndex]
      const away = rotation[rotation.length - 1 - matchIndex]

      if (!home || !away) continue

      const shouldFlipHomeAway = roundIndex % 2 === 1 && matchIndex === 0

      matches.push({
        home_participant_id: shouldFlipHomeAway ? away : home,
        away_participant_id: shouldFlipHomeAway ? home : away,
        round: roundIndex + 1,
        status: 'pending',
      })
    }

    const fixed = rotation[0]
    const moved = rotation.pop() ?? null
    rotation.splice(1, 0, moved)
    rotation[0] = fixed
  }

  if (hasReturnMatch) {
    const returnMatches = matches.map((match) => ({
      home_participant_id: match.away_participant_id,
      away_participant_id: match.home_participant_id,
      round: (match.round ?? 0) + totalRounds,
      status: 'pending' as const,
    }))
    matches.push(...returnMatches)
  }

  return matches
}

function addReturnLegs(matches: Match[]): Match[] {
  if (matches.length === 0) return matches

  const maxRound = Math.max(...matches.map((match) => match.round ?? 0))

  return [
    ...matches,
    ...matches.map((match) => ({
      home_participant_id: match.away_participant_id,
      away_participant_id: match.home_participant_id,
      round: (match.round ?? 0) + maxRound,
      status: 'pending' as const,
    })),
  ]
}

/**
 * ============================================
 * FORMAT: KNOCKOUT (Mata-Mata)
 * ============================================
 * Gera chaves de eliminação com suporte a BYEs se necessário.
 */
function generateKnockoutMatches(participantIds: string[], hasReturnMatch = false): Match[] {
  const matches: Match[] = []

  // Calcular próxima potência de 2
  let nextPowerOfTwo = 1
  while (nextPowerOfTwo < participantIds.length) {
    nextPowerOfTwo *= 2
  }

  // Embaralhar participantes (opcional, aqui mantemos ordem)
  const shuffled = [...participantIds]

  // Montar bracket com BYEs se necessário
  const firstRoundMatches: (string | null)[][] = []
  let index = 0

  for (let i = 0; i < nextPowerOfTwo; i += 2) {
    const home = index < shuffled.length ? shuffled[index++] : null
    const away = index < shuffled.length ? shuffled[index++] : null

    // Se um for null mas o outro não, o que não for null avança automaticamente (BYE)
    if (home || away) {
      firstRoundMatches.push([home, away])
    }
  }

  // Gerar matches para cada rodada
  let currentRound = 1
  let currentMatches = firstRoundMatches

  while (currentMatches.length > 0) {
    // Inserir matches da rodada atual
    for (const [home, away] of currentMatches) {
      matches.push({
        home_participant_id: home,
        away_participant_id: away,
        round: currentRound,
        status: 'pending',
      })
    }

    // Próximas rodadas (será preenchido com resultado das matches anteriores)
    // Em uma implementação futura, isso seria dinâmico
    if (currentMatches.length === 1) {
      break // Final alcançada
    }

    currentRound++
    currentMatches = Array(Math.ceil(currentMatches.length / 2))
      .fill(null)
      .map(() => [null, null])
  }

  return hasReturnMatch ? addReturnLegs(matches) : matches
}

/**
 * ============================================
 * FORMAT: GROUPS CROSSED (Grupos Cruzados)
 * ============================================
 * Divide em grupos, cada membro de um enfrenta todos do outro.
 */
function generateGroupsCrossedMatches(
  participantIds: string[],
  groupCount: number,
  hasReturnMatch = false
): Match[] {
  const matches: Match[] = []

  // Dividir participantes em grupos
  const groupSize = Math.ceil(participantIds.length / groupCount)
  const groups: string[][] = []

  for (let g = 0; g < groupCount; g++) {
    const start = g * groupSize
    const end = Math.min(start + groupSize, participantIds.length)
    groups.push(participantIds.slice(start, end))
  }

  let round = 1

  // Cada membro de um grupo enfrenta todos os do outro
  for (let g1 = 0; g1 < groups.length; g1++) {
    for (let g2 = g1 + 1; g2 < groups.length; g2++) {
      for (const p1 of groups[g1]) {
        for (const p2 of groups[g2]) {
          matches.push({
            home_participant_id: p1,
            away_participant_id: p2,
            round: round,
            status: 'pending',
          })
        }
      }
      round++
    }
  }

  return hasReturnMatch ? addReturnLegs(matches) : matches
}

/**
 * ============================================
 * FORMAT: MIXED (Zona Mista)
 * ============================================
 * Primeira fase em grupos, depois mata-mata com qualificados.
 */
function generateMixedMatches(
  participantIds: string[],
  qualifiedCount: number,
  groupCount: number,
  hasReturnMatch = false
): Match[] {
  const matches: Match[] = []

  // Fase 1: Grupos Cruzados
  const groupMatches = generateGroupsCrossedMatches(participantIds, groupCount, hasReturnMatch)
  matches.push(...groupMatches)

  // Fase 2: Mata-Mata com os qualificados
  // Em uma implementação completa, isso seria dinâmico baseado nos resultados dos grupos
  const qualifiedIds = participantIds.slice(0, qualifiedCount)
  const knockoutMatches = generateKnockoutMatches(qualifiedIds, hasReturnMatch)

  // Aumentar round das matches de knockout
  const adjustedKnockout = knockoutMatches.map((m) => ({
    ...m,
    round: (m.round || 0) + Math.max(...groupMatches.map((gm) => gm.round || 1)),
  }))

  matches.push(...adjustedKnockout)

  return matches
}

/**
 * ============================================
 * CAMPEONATO: Gerar Fase Final (Playoff)
 * ============================================
 * Pega os top N da classificação da liga e gera semifinais.
 * Depois, pega os vencedores das semifinais para gerar a final.
 *
 * Bracket:
 *   top4: 1º vs 4º  +  2º vs 3º → vencedores fazem a final
 *   top2: 1º vs 2º (final direta)
 */
export async function generatePlayoffMatches(tournamentId: string): Promise<void> {
  console.log('🏆 Iniciando geração de playoff para torneio:', tournamentId)
  
  // 1. Buscar settings do torneio
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error('Torneio não encontrado')
  }

  const tournamentSettings = tournament.settings as TournamentSettings | null
  const cutoff = tournamentSettings?.playoffCutoff ?? 2
  const playoffTwoLegged = tournamentSettings?.playoffTwoLegged === true
  console.log('📊 Playoff cutoff:', cutoff, '| Ida/volta mata-mata:', playoffTwoLegged)

  const { count: participantCountRaw, error: participantCountError } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  if (participantCountError) {
    throw new Error(`Falha ao contar participantes: ${participantCountError.message}`)
  }

  const participantCount = participantCountRaw ?? 0
  const leagueRoundCount = campeonatoLeagueRoundCount(
    participantCount,
    tournamentSettings?.hasReturnMatch ?? false
  )

  // 2. Buscar todas as partidas do torneio
  const { data: allMatches, error: matchesError } = await supabase
    .from('matches')
    .select(
      'id, round, home_participant_id, away_participant_id, status, home_score, away_score, home_penalties, away_penalties, playoff_pair_index, playoff_leg'
    )
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })

  if (matchesError) {
    throw new Error(`Falha ao buscar partidas: ${matchesError.message}`)
  }

  const rounds = allMatches?.map((m) => m.round ?? 0) ?? []
  const maxRound = Math.max(...rounds, 0)
  console.log('📈 Rodada máxima atual:', maxRound)

  // Playoff = rodadas depois da fase de pontos corridos (não usar maxRound-2: isso marcava as 2 últimas rodadas da liga como playoff)
  const playoffMatches =
    allMatches?.filter((m) => m.round !== null && m.round !== undefined && m.round > leagueRoundCount) ?? []
  const hasPlayoffMatches = playoffMatches.length > 0

  console.log('🎯 Liga — última rodada:', leagueRoundCount, '| Partidas de playoff existentes:', playoffMatches.length)

  if (cutoff === 4 && !hasPlayoffMatches) {
    console.log('🚀 Gerando semifinais...')
    
    // Buscar classificação da liga para pegar os top 4
    const standings = await getTournamentStandings(tournamentId, { maxRound: leagueRoundCount })
    if (standings.length < 4) {
      throw new Error('São necessários pelo menos 4 participantes para gerar semifinais')
    }
    
    const top4 = standings.slice(0, 4).map((s) => s.participant_id)
    console.log('🏅 Top 4 classificados:', top4)

    const nextPlayoffRound = leagueRoundCount + 1

    const semifinalMatches: Match[] = playoffTwoLegged
      ? [
          {
            tournament_id: tournamentId,
            home_participant_id: top4[0],
            away_participant_id: top4[3],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: 1,
          },
          {
            tournament_id: tournamentId,
            home_participant_id: top4[3],
            away_participant_id: top4[0],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: 2,
          },
          {
            tournament_id: tournamentId,
            home_participant_id: top4[1],
            away_participant_id: top4[2],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 1,
            playoff_leg: 1,
          },
          {
            tournament_id: tournamentId,
            home_participant_id: top4[2],
            away_participant_id: top4[1],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 1,
            playoff_leg: 2,
          },
        ]
      : [
          {
            tournament_id: tournamentId,
            home_participant_id: top4[0],
            away_participant_id: top4[3],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: null,
          },
          {
            tournament_id: tournamentId,
            home_participant_id: top4[1],
            away_participant_id: top4[2],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 1,
            playoff_leg: null,
          },
        ]

    const { error: insertError } = await supabase.from('matches').insert(semifinalMatches)
    if (insertError) {
      throw new Error(`Falha ao inserir semifinais: ${insertError.message}`)
    }
    
    console.log('✅ Semifinais criadas com sucesso!')
    return
  }

  // Gerar final após semifinais concluídas (partida única ou ida/volta + pênaltis se necessário)
  if (cutoff === 4) {
    const semiRound = leagueRoundCount + 1
    const finalRound = leagueRoundCount + 2
    const semifinalFinished =
      allMatches?.filter((m) => m.round === semiRound && m.status === 'finished') ?? []
    const finalExists = allMatches?.some((m) => m.round === finalRound) ?? false

    console.log('🔍 Semifinais finalizadas:', semifinalFinished.length)
    console.log('🏆 Final já existe:', finalExists)

    if (!finalExists && canAdvanceFromSemifinalsToFinal(semifinalFinished as KnockoutMatchCore[], playoffTwoLegged)) {
      console.log('🎯 Gerando final com vencedores das semifinais...')
      let winners: string[]
      try {
        winners = extractSemifinalWinnersForFinal(semifinalFinished as KnockoutMatchCore[], playoffTwoLegged)
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Não foi possível definir os finalistas')
      }

      if (winners.length !== 2 || !winners[0] || !winners[1]) {
        throw new Error('Erro ao determinar os dois finalistas')
      }

      const finalRows: Match[] = playoffTwoLegged
        ? [
            {
              tournament_id: tournamentId,
              home_participant_id: winners[0],
              away_participant_id: winners[1],
              round: finalRound,
              status: 'pending',
              playoff_pair_index: 0,
              playoff_leg: 1,
            },
            {
              tournament_id: tournamentId,
              home_participant_id: winners[1],
              away_participant_id: winners[0],
              round: finalRound,
              status: 'pending',
              playoff_pair_index: 0,
              playoff_leg: 2,
            },
          ]
        : [
            {
              tournament_id: tournamentId,
              home_participant_id: winners[0],
              away_participant_id: winners[1],
              round: finalRound,
              status: 'pending',
              playoff_pair_index: 0,
              playoff_leg: null,
            },
          ]

      const { error: insertFinalError } = await supabase.from('matches').insert(finalRows)
      if (insertFinalError) {
        throw new Error(`Falha ao inserir final: ${insertFinalError.message}`)
      }

      console.log('✅ Final criada com sucesso!')
      console.log('🥊 Finalistas:', winners)
      return
    }
  }

  // Para top2: final direta (uma ou duas pernas)
  if (cutoff === 2 && !hasPlayoffMatches) {
    console.log('🚀 Gerando final direta (top 2)...')
    
    const standings = await getTournamentStandings(tournamentId, { maxRound: leagueRoundCount })
    if (standings.length < 2) {
      throw new Error('São necessários pelo menos 2 participantes para gerar final')
    }
    
    const top2 = standings.slice(0, 2).map((s) => s.participant_id)
    console.log('🏅 Top 2 classificados:', top2)

    const nextPlayoffRound = leagueRoundCount + 1

    const finalRows: Match[] = playoffTwoLegged
      ? [
          {
            tournament_id: tournamentId,
            home_participant_id: top2[0],
            away_participant_id: top2[1],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: 1,
          },
          {
            tournament_id: tournamentId,
            home_participant_id: top2[1],
            away_participant_id: top2[0],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: 2,
          },
        ]
      : [
          {
            tournament_id: tournamentId,
            home_participant_id: top2[0],
            away_participant_id: top2[1],
            round: nextPlayoffRound,
            status: 'pending',
            playoff_pair_index: 0,
            playoff_leg: null,
          },
        ]

    const { error: insertFinalError } = await supabase.from('matches').insert(finalRows)
    if (insertFinalError) {
      throw new Error(`Falha ao inserir final: ${insertFinalError.message}`)
    }
    
    console.log('✅ Final direta criada com sucesso!')
    return
  }

  throw new Error(
    'Não foi possível gerar a próxima fase: playoff já existe ou ainda faltam resultados (ex.: semifinais em empate ou incompletas).'
  )
}