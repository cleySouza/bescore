/**
 * Default voting window for pending score proposals (MVP).
 * DB trigger `match_score_proposals_before_insert` also sets 15 minutes server-side.
 */
export const SCORE_PROPOSAL_DEFAULT_DEADLINE_MS = 15 * 60 * 1000
