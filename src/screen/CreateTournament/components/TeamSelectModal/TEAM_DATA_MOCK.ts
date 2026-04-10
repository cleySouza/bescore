// Loaded dynamically via import() when the modal opens — kept out of the initial bundle.

export interface Club {
  id: string
  name: string
  /** Absolute path served from /public/assets/logos/. Falls back to initials. */
  logo: string
  /** Fallback background color when logo 404s */
  color: string
}

export interface League {
  id: string
  name: string
  logo: string
  color: string
  /** Display label inside the league card (e.g. country flag + name) */
  label: string
}

export interface TeamDataMap {
  [leagueId: string]: Club[]
}

// ─── Step 1: Leagues / Continents ─────────────────────────────────────────────
export const LEAGUES: League[] = [
  { id: 'premierLeague',  name: 'Premier League',    logo: '/assets/logos/leagues/pl.png',        color: '#3D195B', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League' },
  { id: 'laLiga',         name: 'La Liga',            logo: '/assets/logos/leagues/laliga.png',    color: '#FF4B44', label: '🇪🇸 La Liga' },
  { id: 'bundesliga',     name: 'Bundesliga',         logo: '/assets/logos/leagues/bundesliga.png',color: '#D3010C', label: '🇩🇪 Bundesliga' },
  { id: 'serieA',         name: 'Serie A',            logo: '/assets/logos/leagues/seriea.png',    color: '#1B3A6B', label: '🇮🇹 Serie A' },
  { id: 'ligue1',         name: 'Ligue 1',            logo: '/assets/logos/leagues/ligue1.png',    color: '#DFFE00', label: '🇫🇷 Ligue 1' },
  { id: 'brasileirao',    name: 'Brasileirão',        logo: '/assets/logos/leagues/brasileirao.png', color: '#009C3B', label: '🇧🇷 Brasileirão' },
  { id: 'southAmerica',   name: 'South America',      logo: '/assets/logos/leagues/conmebol.png',  color: '#003F7E', label: '🌎 South America' },
  { id: 'europe',         name: 'Europe',             logo: '/assets/logos/leagues/europe.png',    color: '#0E1E5B', label: '🌍 Europe' },
]

// ─── Step 2: Clubs per League ──────────────────────────────────────────────────
export const TEAM_DATA: TeamDataMap = {
  premierLeague: [
    { id: 'arsenal',      name: 'Arsenal',        logo: '/assets/logos/pl/arsenal.png',      color: '#EF0107' },
    { id: 'chelsea',      name: 'Chelsea',        logo: '/assets/logos/pl/chelsea.png',      color: '#034694' },
    { id: 'mancity',      name: 'Man City',       logo: '/assets/logos/pl/mancity.png',      color: '#6CABDD' },
    { id: 'manutd',       name: 'Man Utd',        logo: '/assets/logos/pl/manutd.png',       color: '#DA020E' },
    { id: 'liverpool',    name: 'Liverpool',      logo: '/assets/logos/pl/liverpool.png',    color: '#C8102E' },
    { id: 'tottenham',    name: 'Tottenham',      logo: '/assets/logos/pl/tottenham.png',    color: '#132257' },
    { id: 'newcastle',    name: 'Newcastle',      logo: '/assets/logos/pl/newcastle.png',    color: '#241F20' },
    { id: 'aston_villa',  name: 'Aston Villa',    logo: '/assets/logos/pl/astonvilla.png',   color: '#95BFE5' },
    { id: 'brighton',     name: 'Brighton',       logo: '/assets/logos/pl/brighton.png',     color: '#0057B8' },
    { id: 'west_ham',     name: 'West Ham',       logo: '/assets/logos/pl/westham.png',      color: '#7A263A' },
    { id: 'everton',      name: 'Everton',        logo: '/assets/logos/pl/everton.png',      color: '#003399' },
    { id: 'wolves',       name: 'Wolves',         logo: '/assets/logos/pl/wolves.png',       color: '#FDB913' },
    { id: 'crystal_palace', name: 'Crystal Palace', logo: '/assets/logos/pl/crystalpalace.png', color: '#1B458F' },
    { id: 'brentford',    name: 'Brentford',      logo: '/assets/logos/pl/brentford.png',    color: '#E30613' },
    { id: 'fulham',       name: 'Fulham',         logo: '/assets/logos/pl/fulham.png',       color: '#CC0000' },
    { id: 'nottm_forest', name: 'Nottm Forest',   logo: '/assets/logos/pl/nottmforest.png',  color: '#DD0000' },
    { id: 'southampton',  name: 'Southampton',    logo: '/assets/logos/pl/southampton.png',  color: '#D71920' },
    { id: 'leicester',    name: 'Leicester',      logo: '/assets/logos/pl/leicester.png',    color: '#003090' },
    { id: 'ipswich',      name: 'Ipswich',        logo: '/assets/logos/pl/ipswich.png',      color: '#0044A0' },
    { id: 'bournemouth',  name: 'Bournemouth',    logo: '/assets/logos/pl/bournemouth.png',  color: '#DA291C' },
  ],

  laLiga: [
    { id: 'real_madrid',  name: 'Real Madrid',     logo: '/assets/logos/laliga/realmadrid.png',  color: '#FEBE10' },
    { id: 'barcelona',    name: 'Barcelona',       logo: '/assets/logos/laliga/barcelona.png',   color: '#A50044' },
    { id: 'atletico',     name: 'Atlético Madrid', logo: '/assets/logos/laliga/atletico.png',    color: '#CB3524' },
    { id: 'sevilla',      name: 'Sevilla',         logo: '/assets/logos/laliga/sevilla.png',     color: '#D4021D' },
    { id: 'valencia',     name: 'Valencia',        logo: '/assets/logos/laliga/valencia.png',    color: '#FF7F00' },
    { id: 'villarreal',   name: 'Villarreal',      logo: '/assets/logos/laliga/villarreal.png',  color: '#FFCD00' },
    { id: 'athletic',     name: 'Athletic Bilbao', logo: '/assets/logos/laliga/athletic.png',    color: '#EE2523' },
    { id: 'sociedad',     name: 'Real Sociedad',   logo: '/assets/logos/laliga/sociedad.png',    color: '#0067B1' },
    { id: 'betis',        name: 'Real Betis',      logo: '/assets/logos/laliga/betis.png',       color: '#00833E' },
    { id: 'osasuna',      name: 'Osasuna',         logo: '/assets/logos/laliga/osasuna.png',     color: '#BB1122' },
    { id: 'celta',        name: 'Celta Vigo',      logo: '/assets/logos/laliga/celta.png',       color: '#82CBE8' },
    { id: 'getafe',       name: 'Getafe',          logo: '/assets/logos/laliga/getafe.png',      color: '#025CA8' },
    { id: 'girona',       name: 'Girona',          logo: '/assets/logos/laliga/girona.png',      color: '#CC0000' },
    { id: 'rayo',         name: 'Rayo Vallecano',  logo: '/assets/logos/laliga/rayo.png',        color: '#CC0000' },
    { id: 'espanyol',     name: 'Espanyol',        logo: '/assets/logos/laliga/espanyol.png',    color: '#004D98' },
    { id: 'mallorca',     name: 'Mallorca',        logo: '/assets/logos/laliga/mallorca.png',    color: '#CC0000' },
    { id: 'alaves',       name: 'Deportivo Alavés',logo: '/assets/logos/laliga/alaves.png',      color: '#0D47A1' },
    { id: 'las_palmas',   name: 'Las Palmas',      logo: '/assets/logos/laliga/laspalmas.png',   color: '#FFCC00' },
    { id: 'valladolid',   name: 'Valladolid',      logo: '/assets/logos/laliga/valladolid.png',  color: '#5C2D91' },
    { id: 'leganes',      name: 'Leganés',         logo: '/assets/logos/laliga/leganes.png',     color: '#004594' },
  ],

  bundesliga: [
    { id: 'bayern',      name: 'Bayern Munich',  logo: '/assets/logos/bundesliga/bayern.png',    color: '#DC052D' },
    { id: 'dortmund',    name: 'B. Dortmund',    logo: '/assets/logos/bundesliga/dortmund.png',  color: '#FDE100' },
    { id: 'leverkusen',  name: 'Bayer 04',       logo: '/assets/logos/bundesliga/leverkusen.png',color: '#E32221' },
    { id: 'leipzig',     name: 'RB Leipzig',     logo: '/assets/logos/bundesliga/leipzig.png',   color: '#DD0741' },
    { id: 'frankfurt',   name: 'Eintracht',      logo: '/assets/logos/bundesliga/frankfurt.png', color: '#E1000F' },
    { id: 'wolfsburg',   name: 'Wolfsburg',      logo: '/assets/logos/bundesliga/wolfsburg.png', color: '#65B32E' },
    { id: 'freiburg',    name: 'Freiburg',       logo: '/assets/logos/bundesliga/freiburg.png',  color: '#E8001A' },
    { id: 'monchengladbach', name: 'M\'gladbach', logo: '/assets/logos/bundesliga/mgladbach.png', color: '#000000' },
  ],

  serieA: [
    { id: 'juventus',    name: 'Juventus',       logo: '/assets/logos/seriea/juventus.png',   color: '#000000' },
    { id: 'inter',       name: 'Inter Milan',    logo: '/assets/logos/seriea/inter.png',      color: '#010E80' },
    { id: 'milan',       name: 'AC Milan',       logo: '/assets/logos/seriea/milan.png',      color: '#FB090B' },
    { id: 'napoli',      name: 'Napoli',         logo: '/assets/logos/seriea/napoli.png',     color: '#087AC1' },
    { id: 'roma',        name: 'AS Roma',        logo: '/assets/logos/seriea/roma.png',       color: '#8E1F2F' },
    { id: 'lazio',       name: 'Lazio',          logo: '/assets/logos/seriea/lazio.png',      color: '#87D8F7' },
    { id: 'fiorentina',  name: 'Fiorentina',     logo: '/assets/logos/seriea/fiorentina.png', color: '#4B3D8F' },
    { id: 'atalanta',    name: 'Atalanta',       logo: '/assets/logos/seriea/atalanta.png',   color: '#1E3A5F' },
  ],

  ligue1: [
    { id: 'psg',         name: 'PSG',            logo: '/assets/logos/ligue1/psg.png',        color: '#004170' },
    { id: 'marseille',   name: 'Marseille',      logo: '/assets/logos/ligue1/marseille.png',  color: '#2FAEE0' },
    { id: 'monaco',      name: 'Monaco',         logo: '/assets/logos/ligue1/monaco.png',     color: '#D4021D' },
    { id: 'lyon',        name: 'Lyon',           logo: '/assets/logos/ligue1/lyon.png',       color: '#1D1D1B' },
    { id: 'nice',        name: 'Nice',           logo: '/assets/logos/ligue1/nice.png',       color: '#E3001B' },
    { id: 'lens',        name: 'RC Lens',        logo: '/assets/logos/ligue1/lens.png',       color: '#F5A623' },
  ],

  brasileirao: [
    { id: 'flamengo',      name: 'Flamengo',         logo: '/assets/logos/brasileirao/flamengo.png',     color: '#CC0000' },
    { id: 'palmeiras',     name: 'Palmeiras',        logo: '/assets/logos/brasileirao/palmeiras.png',    color: '#006633' },
    { id: 'corinthians',   name: 'Corinthians',      logo: '/assets/logos/brasileirao/corinthians.png',  color: '#000000' },
    { id: 'atletico_mg',   name: 'Atlético-MG',      logo: '/assets/logos/brasileirao/atleticomg.png',   color: '#000000' },
    { id: 'fluminense',    name: 'Fluminense',       logo: '/assets/logos/brasileirao/fluminense.png',   color: '#8B0000' },
    { id: 'internacional', name: 'Internacional',    logo: '/assets/logos/brasileirao/inter.png',        color: '#DD0000' },
    { id: 'gremio',        name: 'Grêmio',           logo: '/assets/logos/brasileirao/gremio.png',       color: '#005CA9' },
    { id: 'sao_paulo',     name: 'São Paulo',        logo: '/assets/logos/brasileirao/saopaulo.png',     color: '#E50000' },
    { id: 'cruzeiro',      name: 'Cruzeiro',         logo: '/assets/logos/brasileirao/cruzeiro.png',     color: '#003087' },
    { id: 'bahia',         name: 'Bahia',            logo: '/assets/logos/brasileirao/bahia.png',        color: '#0055A4' },
    { id: 'vasco',         name: 'Vasco da Gama',    logo: '/assets/logos/brasileirao/vasco.png',        color: '#000000' },
    { id: 'botafogo',      name: 'Botafogo',         logo: '/assets/logos/brasileirao/botafogo.png',     color: '#000000' },
    { id: 'atletico_go',   name: 'Atlético-GO',      logo: '/assets/logos/brasileirao/atleticogo.png',   color: '#CC0000' },
    { id: 'fortaleza',     name: 'Fortaleza',        logo: '/assets/logos/brasileirao/fortaleza.png',    color: '#0A2A72' },
    { id: 'sport',         name: 'Sport Recife',     logo: '/assets/logos/brasileirao/sport.png',        color: '#CC0000' },
    { id: 'santos',        name: 'Santos',           logo: '/assets/logos/brasileirao/santos.png',       color: '#000000' },
    { id: 'ceara',         name: 'Ceará',            logo: '/assets/logos/brasileirao/ceara.png',        color: '#000000' },
    { id: 'juventude',     name: 'Juventude',        logo: '/assets/logos/brasileirao/juventude.png',    color: '#1A7A1A' },
    { id: 'red_bull_bragantino', name: 'RB Bragantino', logo: '/assets/logos/brasileirao/bragantino.png', color: '#CC0000' },
    { id: 'mirassol',      name: 'Mirassol',         logo: '/assets/logos/brasileirao/mirassol.png',     color: '#FFDD00' },
  ],

  southAmerica: [
    { id: 'boca',          name: 'Boca Juniors',    logo: '/assets/logos/southamerica/boca.png',       color: '#1A3D8F' },
    { id: 'river',         name: 'River Plate',     logo: '/assets/logos/southamerica/river.png',      color: '#D4021D' },
    { id: 'nacional',      name: 'Nacional (URU)',  logo: '/assets/logos/southamerica/nacional.png',   color: '#CC0000' },
    { id: 'penarol',       name: 'Peñarol',         logo: '/assets/logos/southamerica/penarol.png',    color: '#F5C518' },
    { id: 'colo_colo',     name: 'Colo-Colo',       logo: '/assets/logos/southamerica/colocolo.png',   color: '#000000' },
    { id: 'racing',        name: 'Racing Club',     logo: '/assets/logos/southamerica/racing.png',     color: '#1A3D8F' },
    { id: 'independiente', name: 'Independiente',   logo: '/assets/logos/southamerica/independiente.png', color: '#CC0000' },
    { id: 'san_lorenzo',   name: 'San Lorenzo',     logo: '/assets/logos/southamerica/sanlorenzo.png', color: '#0047AB' },
    { id: 'ldu',           name: 'LDU Quito',       logo: '/assets/logos/southamerica/ldu.png',        color: '#FFFF00' },
    { id: 'olimpia',       name: 'Olimpia',         logo: '/assets/logos/southamerica/olimpia.png',    color: '#000000' },
    { id: 'alianza_lima',  name: 'Alianza Lima',    logo: '/assets/logos/southamerica/alianzalima.png',color: '#43127F' },
    { id: 'universitario', name: 'Universitario',   logo: '/assets/logos/southamerica/universitario.png', color: '#AA0000' },
    { id: 'union_espanola',name: 'Unión Española',  logo: '/assets/logos/southamerica/unionespanola.png', color: '#D40000' },
    { id: 'junior',        name: 'Junior Barranquilla', logo: '/assets/logos/southamerica/junior.png', color: '#E30613' },
    { id: 'millonarios',   name: 'Millonarios',     logo: '/assets/logos/southamerica/millonarios.png',color: '#003DA5' },
    { id: 'atletico_nacional', name: 'Atl. Nacional', logo: '/assets/logos/southamerica/atleticonacional.png', color: '#006633' },
  ],

  europe: [
    { id: 'ajax',          name: 'Ajax',           logo: '/assets/logos/europe/ajax.png',          color: '#D2122E' },
    { id: 'psv',           name: 'PSV',            logo: '/assets/logos/europe/psv.png',           color: '#EE1C25' },
    { id: 'porto',         name: 'Porto',          logo: '/assets/logos/europe/porto.png',         color: '#0046A8' },
    { id: 'benfica',       name: 'Benfica',        logo: '/assets/logos/europe/benfica.png',       color: '#CC0000' },
    { id: 'celtic',        name: 'Celtic',         logo: '/assets/logos/europe/celtic.png',        color: '#168737' },
    { id: 'rangers',       name: 'Rangers',        logo: '/assets/logos/europe/rangers.png',       color: '#1B458F' },
    { id: 'galatasaray',   name: 'Galatasaray',    logo: '/assets/logos/europe/galatasaray.png',   color: '#E4002B' },
    { id: 'fenerbahce',    name: 'Fenerbahce',     logo: '/assets/logos/europe/fenerbahce.png',    color: '#003399' },
    { id: 'anderlecht',    name: 'Anderlecht',     logo: '/assets/logos/europe/anderlecht.png',    color: '#6A0DAD' },
    { id: 'club_brugge',   name: 'Club Brugge',    logo: '/assets/logos/europe/clubbrugge.png',    color: '#1B5E8B' },
    { id: 'shakhtar',      name: 'Shakhtar',       logo: '/assets/logos/europe/shakhtar.png',      color: '#F77F00' },
    { id: 'dinamo_zagreb', name: 'Dinamo Zagreb',  logo: '/assets/logos/europe/dinamozagreb.png',  color: '#005DA8' },
    { id: 'red_star',      name: 'Red Star Belgrade', logo: '/assets/logos/europe/redstar.png',   color: '#CC0000' },
    { id: 'sporting_cp',   name: 'Sporting CP',    logo: '/assets/logos/europe/sportingcp.png',   color: '#006633' },
    { id: 'feyenoord',     name: 'Feyenoord',      logo: '/assets/logos/europe/feyenoord.png',    color: '#CC0000' },
    { id: 'besiktas',      name: 'Beşiktaş',       logo: '/assets/logos/europe/besiktas.png',     color: '#000000' },
  ],
}
