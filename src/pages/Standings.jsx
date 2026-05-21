import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/Standings.css'

// generate every season from 2002 up to the current year
const currentYear = (new Date().getFullYear())-1
const SEASONS = Array.from(
  { length: currentYear - 2002 + 1 },
  (_, i) => currentYear - i  // starts from current year and counts down
)
  // ESPN standings endpoint doesn't return team colors so we hardcode them
const TEAM_COLORS = {
  '1': 'a71930',  // ATL
  '2': '00338d',  // BUF
  '3': '0b162a',  // CHI
  '4': 'fb4f14',  // CIN
  '5': '311d00',  // CLE
  '6': '003594',  // DAL
  '7': 'fb4f14',  // DEN
  '8': '0076b6',  // DET
  '9': '203731',  // GB
  '10': '4b92db', // TEN
  '11': '002c5f', // IND
  '12': 'e31837', // KC
  '13': 'a5acaf', // LV
  '14': '003594', // LAR
  '15': '008e97', // MIA
  '16': '4f2683', // MIN
  '17': '002244', // NE
  '18': 'd3bc8d', // NO
  '19': '0b2265', // NYG
  '20': '125740', // NYJ
  '21': '004c54', // PHI
  '22': '97233f', // ARI
  '23': 'ffb612', // PIT
  '24': '0080c6', // LAC
  '25': 'aa0000', // SF
  '26': '002244', // SEA
  '27': 'd50a0a', // TB
  '28': '5a1414', // WSH
  '29': '0085ca', // CAR
  '30': '006778', // JAX
  '33': '241773', // BAL
  '34': '03202f', // HOU
}
function Standings() {
  /* useState gives us a value and a function to update it
  when we call the setter function, React re-renders the component */
  const [standings, setStandings] = useState([])  // starts as empty array
  const [loading, setLoading] = useState(true)    // starts as true because we are loading
  const [error, setError] = useState(null)        // starts as null because no error yet
  // functionality to allow url it fall back 
  const { season: seasonParam } = useParams()
  // seasonParam because season is already used as state below
  const [season, setSeason] = useState(seasonParam ? Number(seasonParam) : currentYear)
  //allows us to click on a team
  const navigate = useNavigate()  
  

  /*  useEffect runs after the component first appears on screen
  the [season] means: re-run this whenever the selected season changes */
  useEffect(() => {
    setLoading(true)
    setError(null)
    /*  go to this URL and gets the data back
    .then chains run one after another when each step finishes, convert raw response to JavaScript object 
    data.children is the array of conferences [AFC, NFC], then the || [] is a safety net - if children is undefined, use empty array instead
    and at the end data has been iterated over so turn off loading 
    .catch runs if anything in the chain above fails */
    fetch(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}`)
      .then(res => res.json())         
      .then(data => {
        setStandings(data.children || [])
        setLoading(false)             
      })
      .catch(err => {
        setError('Failed to load standings')
        setLoading(false)
      })

  }, [season])

  /* guard clause if still loading, return early and show loading message
  nothing below this line runs while loading is true */
  if (loading) return (
    <div className="status-msg loading-pulse">Loading standings...</div>
  )

  // guard clause if something went wrong, show the error message 
  if (error) return (
    <div className="status-msg">{error}</div>
  )

  // if we get here, we have data - render the standings
  return (
    <div className="standings-container">
      <div className="standings-header">
        <p className="standings-label">{season} Season</p>
        <h2 className="standings-title">NFL <span>Standings</span></h2>
      </div>

      {/* season dropdown — defaults to current year, refetches when changed */}
      <div className="season-select-wrap">
        <select
          className="season-select"
          value={season}
          onChange={e => {
            const yr = Number(e.target.value)
            setSeason(yr)
            navigate(`/standings/${yr}`)
          }}
        >
          {SEASONS.map(yr => (
            <option key={yr} value={yr}>{yr} Season</option>
          ))}
        </select>
      </div>

      {/* outer .map() - runs twice, once for AFC and once for NFC */}
      {standings.map((conference) => {
        const isAFC = conference.abbreviation === 'AFC'
        

        return (
          <div key={conference.abbreviation} className="conference-block">
            <div className="conference-header">

              {/* ternary: if AFC use blue badge, if NFC use purple badge */}
              <span className={`conference-badge ${isAFC ? 'badge-afc' : 'badge-nfc'}`}>
                {conference.name}
              </span>
              <div className="conference-line"></div>
            </div>

            <div className="division-card">
              <div className="division-header">
                <span className="division-name">Team</span>
                <div className="division-stats-header">
                  <span>W</span>
                  <span>L</span>
                  <span>PCT</span>
                </div>
              </div>

              {/* inner .map() - loops through all 16 teams in this conference */}
              {/* index is a counter (0,1,2...) that .map() gives us automatically */}
              {(conference.standings?.entries || [])
                .slice()
                .sort((a, b) => {
                  const winsA = a.stats.find(s => s.name === 'wins')?.value || 0
                  const winsB = b.stats.find(s => s.name === 'wins')?.value || 0
                  return winsB - winsA
                })
                .map((entry, index) => {
                  // .find() searches the stats array by name instead of position
                  // ?. (optional chaining) prevents a crash if .find() returns nothing
                  const wins = entry.stats.find(s => s.name === 'wins')?.displayValue || '0'
                  const losses = entry.stats.find(s => s.name === 'losses')?.displayValue || '0'
                  const pct = entry.stats.find(s => s.name === 'winPercent')?.displayValue || '.000'
                  console.log(entry.team.shortDisplayName, entry.team.color)
                return (
                  <div
                    key={entry.team.id}
                    className={`team-row ${index === 0 ? "first-place" : ""}`}
                    onClick={() => {
                      const record = entry.stats.find(s => s.name === "wins")?.displayValue + "-" + 
                        entry.stats.find(s => s.name === "losses")?.displayValue
                      navigate(`/team/${entry.team.id}/${season}/${record}`)
                    }}
                    style={{ 
                      cursor: "pointer",
                      borderLeft: `3px solid #${TEAM_COLORS[entry.team.id] || '1e1e2e'}`
                    }}
                  >
                    <span className="team-rank">{index + 1}</span>
                    <img
                      src={entry.team.logos[0].href}
                      alt={entry.team.name}
                      className="team-logo"
                    />
                    <span className="team-name">{entry.team.shortDisplayName}</span>
                    <div className="team-stats">
                      <span>{wins}</span>
                      <span>{losses}</span>
                      <span>{pct}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Standings