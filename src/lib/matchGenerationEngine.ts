import { supabase } from './supabaseClient'
import type { Database } from '../types/supabase'
import type { TournamentSettings, TournamentFormat } from '../types/tournament'
import { validateSettingsForFormat } from '../types/tournament'
import { getTournamentStandings } from './matchService'

type Match = Database['public']['Tables']['matches']['Insert']

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
  const mergedSettings = {
    ...(existingSettings ?? {}),
    ...JSON.parse(JSON.stringify(settings)),
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
 * Pega os top N da classificação da liga (round 1) e gera
 * partidas de mata-mata (round 2).
 *
 * Bracket:
 *   top4: 1º vs 4º  +  2º vs 3º
 *   top2: 1º vs 2º
 */
export async function generatePlayoffMatches(tournamentId: string): Promise<void> {
  // 1. Buscar settings do torneio para saber o playoffCutoff
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error('Torneio não encontrado')
  }

  const settings = tournament.settings as { playoffCutoff?: number } | null
  const cutoff = settings?.playoffCutoff ?? 2

  // Buscar todas as partidas do torneio
  const { data: allMatches, error: matchesError } = await supabase
    .from('matches')
    .select('id, round, home_participant_id, away_participant_id, status')
    .eq('tournament_id', tournamentId)

  if (matchesError) {
    throw new Error(`Falha ao buscar rodadas atuais: ${matchesError.message}`)
  }

  // Buscar classificação atual
  const standings = await getTournamentStandings(tournamentId)
  if (standings.length < cutoff) {
    throw new Error(`São necessários pelo menos ${cutoff} participantes classificados`)
  }
  const topN = standings.slice(0, cutoff).map((s) => s.participant_id)

  // Identificar rodadas já existentes
  const rounds = allMatches?.map((m) => m.round ?? 0) ?? []
  const maxRound = Math.max(...rounds, 0)

  // Se não existem semifinais, cria semifinais
  if (cutoff === 4 && !allMatches?.some(m => m.round === maxRound && m.status === 'pending')) {
    // Semifinais: 1º vs 4º, 2º vs 3º
    const playoffMatches = [
      { tournament_id: tournamentId, home_participant_id: topN[0], away_participant_id: topN[3], round: maxRound + 1, status: 'pending' },
      { tournament_id: tournamentId, home_participant_id: topN[1], away_participant_id: topN[2], round: maxRound + 1, status: 'pending' }
    ]
    const { error: insertError } = await supabase.from('matches').insert(playoffMatches)
    if (insertError) {
      throw new Error(`Falha ao inserir semifinais: ${insertError.message}`)
    }
    return
  }

  // Se semifinais já existem e estão finalizadas, cria a final
  if (cutoff === 4) {
    // Encontra semifinais (rodada máxima)
    const semifinais = allMatches?.filter(m => m.round === maxRound) ?? []
    const todasFinalizadas = semifinais.length === 2 && semifinais.every(m => m.status === 'finished')
    // Verifica se já existe final
    const jaTemFinal = allMatches?.some(m => m.round === maxRound + 1) ?? false
    if (todasFinalizadas && !jaTemFinal) {
      // Descobre vencedores das semifinais
      const semifinalIds = semifinais.map(m => m.id)
      const { data: resultados, error: resError } = await supabase
        .from('matches')
        .select('id, home_participant_id, away_participant_id, home_score, away_score')
        .in('id', semifinalIds)
      if (resError || !resultados || resultados.length !== 2) {
        throw new Error('Não foi possível buscar resultados das semifinais')
      }
      const vencedores = resultados.map(m => {
        if (m.home_score == null || m.away_score == null) {
          throw new Error('Placar da semifinal não definido. Defina ambos os placares antes de gerar a final.')
        }
        if (m.home_score > m.away_score) return m.home_participant_id
        if (m.away_score > m.home_score) return m.away_participant_id
        // Empate: pode lançar erro ou sortear, aqui lança erro
        throw new Error('Empate em semifinal: defina um vencedor antes de gerar a final')
      })
      // Cria final
      const finalMatch = [{
        tournament_id: tournamentId,
        home_participant_id: vencedores[0],
        away_participant_id: vencedores[1],
        round: maxRound + 1,
        status: 'pending'
      }]
      const { error: insertFinalError } = await supabase.from('matches').insert(finalMatch)
      if (insertFinalError) {
        throw new Error(`Falha ao inserir final: ${insertFinalError.message}`)
      }
      return
    }
  }

  // Para top2: final direta
  if (cutoff === 2 && !allMatches?.some(m => m.round === maxRound + 1)) {
    const finalMatch = [{
      tournament_id: tournamentId,
      home_participant_id: topN[0],
      away_participant_id: topN[1],
      round: maxRound + 1,
      status: 'pending'
    }]
    const { error: insertFinalError } = await supabase.from('matches').insert(finalMatch)
    if (insertFinalError) {
      throw new Error(`Falha ao inserir final: ${insertFinalError.message}`)
    }
    return
  }
}

