import { supabase } from './supabaseClient'
import type { Database } from '../types/supabase'
import type { TournamentSettings, TournamentFormat } from '../types/tournament'
import { validateSettingsForFormat } from '../types/tournament'

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
      matches = generateKnockoutMatches(participantIds)
      break
    case 'groupsCrossed':
      matches = generateGroupsCrossedMatches(participantIds, settings.bracketGroups || 2)
      break
    case 'mixed':
      matches = generateMixedMatches(
        participantIds,
        settings.qualifiedCount || 2,
        settings.bracketGroups || 2
      )
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
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      status: 'active',
      settings: JSON.parse(JSON.stringify(settings)),
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
function generateRoundRobinMatches(participantIds: string[], hasReturnMatch: boolean): Match[] {
  const matches: Match[] = []
  let round = 1

  // Turno (primeira volta)
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      matches.push({
        home_participant_id: participantIds[i],
        away_participant_id: participantIds[j],
        round: round,
        status: 'pending',
      })
    }
  }

  // Returno (segunda volta, se habilitado)
  if (hasReturnMatch) {
    round++
    for (let i = 0; i < participantIds.length; i++) {
      for (let j = 0; j < participantIds.length; j++) {
        if (i !== j && i < j) {
          matches.push({
            home_participant_id: participantIds[j],
            away_participant_id: participantIds[i],
            round: round,
            status: 'pending',
          })
        }
      }
    }
  }

  return matches
}

/**
 * ============================================
 * FORMAT: KNOCKOUT (Mata-Mata)
 * ============================================
 * Gera chaves de eliminação com suporte a BYEs se necessário.
 */
function generateKnockoutMatches(participantIds: string[]): Match[] {
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

  return matches
}

/**
 * ============================================
 * FORMAT: GROUPS CROSSED (Grupos Cruzados)
 * ============================================
 * Divide em grupos, cada membro de um enfrenta todos do outro.
 */
function generateGroupsCrossedMatches(participantIds: string[], groupCount: number): Match[] {
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

  return matches
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
  groupCount: number
): Match[] {
  const matches: Match[] = []

  // Fase 1: Grupos Cruzados
  const groupMatches = generateGroupsCrossedMatches(participantIds, groupCount)
  matches.push(...groupMatches)

  // Fase 2: Mata-Mata com os qualificados
  // Em uma implementação completa, isso seria dinâmico baseado nos resultados dos grupos
  const qualifiedIds = participantIds.slice(0, qualifiedCount)
  const knockoutMatches = generateKnockoutMatches(qualifiedIds)

  // Aumentar round das matches de knockout
  const adjustedKnockout = knockoutMatches.map((m) => ({
    ...m,
    round: (m.round || 0) + Math.max(...groupMatches.map((gm) => gm.round || 1)),
  }))

  matches.push(...adjustedKnockout)

  return matches
}
