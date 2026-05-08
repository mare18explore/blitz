import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/Player.css'

// which stat categories to show per position — filters out irrelevant stats
const POSITION_CATEGORIES = {
	QB:  ['passing', 'rushing'],
	RB:  ['rushing', 'receiving'],
	WR:  ['receiving', 'rushing'],
	TE:  ['receiving'],
	LB:  ['defensive'],
	DE:  ['defensive'],
	CB:  ['defensive', 'defensiveInterceptions'],
	S:   ['defensive', 'defensiveInterceptions'],
	DT:  ['defensive'],
	DB:  ['defensive', 'defensiveInterceptions'],
	K:   ['kicking'],
	P:   ['kicking'],
}

// key stats to display per position — current season boxes and career table columns
const KEY_STATS = {
	QB:  ['YDS', 'TD', 'INT', 'CMP', 'CMP%', 'ATT', 'RTG'],
	RB:  ['YDS', 'TD', 'CAR', 'AVG', 'REC', 'RECYDS'],
	WR:  ['REC', 'YDS', 'TD', 'AVG', 'TGTS'],
	TE:  ['REC', 'YDS', 'TD', 'AVG'],
	LB:  ['TOT', 'SOLO', 'AST', 'SACK', 'TFL'],
	DE:  ['TOT', 'SOLO', 'AST', 'SACK', 'TFL'],
	CB:  ['TOT', 'SOLO', 'PD', 'INT', 'TD'],
	S:   ['TOT', 'SOLO', 'PD', 'INT', 'TD'],
	DT:  ['TOT', 'SOLO', 'AST', 'SACK', 'TFL'],
	DB:  ['TOT', 'SOLO', 'PD', 'INT'],
}

function Player() {
	const { id } = useParams()        // grabs the :id from the URL e.g. /player/3915511
	const navigate = useNavigate()

	const [athlete, setAthlete] = useState(null)
	const [careerStats, setCareerStats] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		fetchPlayerData()
	}, [id]) // re-fetch if the id in the URL changes

	async function fetchPlayerData() {
		setLoading(true)
		setError(null)

		try {
			// fetch the athlete's bio details
			const athleteRes = await fetch(
				`/api/espn/v2/sports/football/leagues/nfl/athletes/${id}`
			)
			const athleteData = await athleteRes.json()
			setAthlete(athleteData)

			// fetch the season log to get a list of seasons this player has stats for
			const seasonsRes = await fetch(
				`/api/espn/v2/sports/football/leagues/nfl/athletes/${id}/statisticslog`
			)
			const seasonsData = await seasonsRes.json()
			const entries = seasonsData.entries || []

			// extract position here so it's accessible inside the map below
			const pos = athleteData.position?.abbreviation?.toUpperCase()
			const allowed = POSITION_CATEGORIES[pos] || ['passing', 'rushing', 'receiving']

			// each entry has a season $ref and a statistics $ref — extract the year from the season URL
			// and fetch the actual stats from the total statistics $ref for each season in parallel
			const seasonFetches = entries.map(entry => {
				const yearMatch = entry.season?.$ref?.match(/seasons\/(\d+)/)
				const year = yearMatch?.[1]
				const statsRef = entry.statistics?.find(s => s.type === 'total')?.statistics?.$ref
				if (!statsRef || !year) return Promise.resolve(null)

				const statsUrl = statsRef
					.replace('https://sports.core.api.espn.com', '/api/espn')
					.replace(/\?.*$/, '')

				return fetch(statsUrl)
					.then(r => r.json())
					.then(data => {
						// only keep categories relevant to this player's position
						const filtered = (data.splits?.categories || []).filter(c => allowed.includes(c.name))
						return ({ year, categories: filtered })
					})
					.catch(() => null)
			})

			const seasonResults = await Promise.all(seasonFetches)

			// filter out any failed fetches and sort newest first
			const seasons = seasonResults
				.filter(Boolean)
				.sort((a, b) => b.year - a.year)

			setCareerStats(seasons)
		} catch (err) {
			console.error(err)
			setError('Failed to load player data')
		} finally {
			setLoading(false)
		}
	}

	if (loading) return <div className="status-msg loading-pulse">Loading player...</div>
	if (error)   return <div className="status-msg">{error}</div>
	if (!athlete) return <div className="status-msg">Player not found.</div>

	// pull out the fields we need from the athlete object
	const headshot   = athlete.headshot?.href
	const name       = athlete.displayName
	const position   = athlete.position?.abbreviation
	const jersey     = athlete.jersey
	const height     = athlete.displayHeight
	const weight     = athlete.displayWeight
	const age        = athlete.age
	const experience = athlete.experience?.years
	const college    = athlete.college?.name

	// newest season is first since we sort descending
	const currentSeason     = careerStats[0]
	const currentSeasonYear = currentSeason?.year

	// key stats for this player's position
	const keyStats = KEY_STATS[position?.toUpperCase()] || []

	return (
		<div className="player-container">

			{/* back button */}
			<button className="back-btn" onClick={() => navigate(-1)}>
				← Back to Stats
			</button>

			{/* top card — headshot on the left, bio on the right */}
			<div className="player-card">
				<div className="player-headshot-wrap">
					{headshot
						? <img src={headshot} alt={name} className="player-headshot" />
						: <div className="player-headshot-placeholder">?</div>
					}
				</div>

				<div className="player-bio">
					<div className="player-position-badge">{position}</div>
					<h1 className="player-name-large">{name}</h1>
					<p className="player-jersey">#{jersey}</p>

					<div className="player-details">
						{height     && <span>{height}</span>}
						{weight     && <span>{weight}</span>}
						{age        && <span>{age} yrs old</span>}
						{experience !== undefined && <span>{experience} yr{experience !== 1 ? 's' : ''} exp</span>}
						{college    && <span>{college}</span>}
					</div>
				</div>
			</div>

			{/* current season stats — only the key stats for this position */}
			{currentSeason && (
        <div className="current-season-wrap">
          <p className="section-label">{currentSeasonYear} Season</p>
          <div className="current-season-stats">
            {(() => {
              const seen = new Set()
              return currentSeason.categories?.flatMap(cat =>
                cat.stats?.filter(stat => {
                  if (!keyStats.includes(stat.abbreviation)) return false
                  if (seen.has(stat.abbreviation)) return false
                  seen.add(stat.abbreviation)
                  return true
                }) || []
              ).map(stat => (
                <div key={stat.name} className="stat-block">
                  <span className="stat-value">{stat.displayValue}</span>
                  <span className="stat-name">{stat.abbreviation}</span>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

			{/* career stats table — one row per season, only key columns */}
			{careerStats.length > 0 && (
				<div className="career-wrap">
					<p className="section-label">Career Stats</p>
					<div className="career-table-wrap">
						<table className="career-table">
							<thead>
								<tr>
									<th>Season</th>
									{keyStats.map(abbr => (
										<th key={abbr}>{abbr}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{careerStats.map(season => {
									// flatten all stats from all categories into one lookup map
									const statMap = {}
									season.categories?.forEach(cat => {
										cat.stats?.forEach(stat => {
											statMap[stat.abbreviation] = stat.displayValue
										})
									})
									return (
										<tr
											key={season.year}
											className={season.year === currentSeasonYear ? 'current-season-row' : ''}
										>
											<td className="season-year">{season.year}</td>
											{keyStats.map(abbr => (
												<td key={abbr}>{statMap[abbr] ?? '—'}</td>
											))}
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}

export default Player