import { useState, useEffect } from 'react'
import '../styles/Stats.css'

const TABS = [
	{ label: 'QB', position: 'QB' },
	{ label: 'RB', position: 'RB' },
	{ label: 'WR', position: 'WR' },
	{ label: 'TE', position: 'TE' },
	{ label: 'DEF', position: 'DEF' },
]

const COLUMNS = {
	QB:  [{ key: 'YDS', label: 'Pass Yds' }, { key: 'TD', label: 'TD' }, { key: 'RAT', label: 'Rating' }, { key: 'PYDS', label: 'Pass Yds/G' }],
	RB:  [{ key: 'YDS', label: 'Rush Yds' }, { key: 'TD', label: 'TD' }, { key: 'TP', label: 'Touch' },   { key: 'KYDS', label: 'KR Yds' }],
	WR:  [{ key: 'YDS', label: 'Rec Yds' },  { key: 'TD', label: 'TD' }, { key: 'REC', label: 'REC' },    { key: 'TTD', label: 'Total TD' }],
	TE:  [{ key: 'YDS', label: 'Rec Yds' },  { key: 'TD', label: 'TD' }, { key: 'REC', label: 'REC' },    { key: 'TTD', label: 'Total TD' }],
	DEF: [{ key: 'TOT', label: 'Tackles' },  { key: 'SACK', label: 'Sacks' }, { key: 'INT', label: 'INT' }, { key: 'PD', label: 'PD' }],
}

// hardcoded because ESPN doesn't return team abbreviation inline on athlete responses
const NFL_TEAMS = {
	'1': 'ATL', '2': 'BUF', '3': 'CHI', '4': 'CIN', '5': 'CLE',
	'6': 'DAL', '7': 'DEN', '8': 'DET', '9': 'GB',  '10': 'TEN',
	'11': 'IND', '12': 'KC', '13': 'LV', '14': 'LAR', '15': 'MIA',
	'16': 'MIN', '17': 'NE', '18': 'NO', '19': 'NYG', '20': 'NYJ',
	'21': 'PHI', '22': 'ARI', '23': 'PIT', '24': 'LAC', '25': 'SF',
	'26': 'SEA', '27': 'TB',  '28': 'WSH', '29': 'CAR', '30': 'JAX',
	'33': 'BAL', '34': 'HOU'
}

// seasons available to pick from 
const currentYear = (new Date().getFullYear()) -1
const SEASONS = Array.from(
  { length: currentYear - 2002 + 1 },
  (_, i) => currentYear - i  // starts from current year and counts down
)


function Stats() {
	const [players, setPlayers] = useState([])
	const [activeTab, setActiveTab] = useState('QB')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [sortKey, setSortKey] = useState('YDS')
	const [sortDir, setSortDir] = useState('desc')
	const [search, setSearch] = useState('')
	const [season, setSeason] = useState(2025) // defaults to current season

	// re-fetch whenever season changes
	useEffect(() => {
		fetchPlayers()
	}, [season])

	async function fetchPlayers() {
		setLoading(true)
		setError(null)
		setPlayers([])

		try {
			// step 1: get stat leaders — season is now dynamic based on dropdown
			const leadersRes = await fetch(
				`/api/espn/v2/sports/football/leagues/nfl/seasons/${season}/types/2/leaders`
			)
			/* leadersData is a JS obj, categories is an array of objects and each obj has 2 strings to denote 
				the name of the category and the abbreviation, 
				then the 3rd is an array of objs (leaders) 
				which is comprised of 2 objs: the stat value and the athlete $ref URL (not the id yet —  we pull the id out of that URL later with regex) */
			const leadersData = await leadersRes.json()

			/* build statsMap and collect unique athlete IDs + $ref paths
			this is how statsMap would look: { "3915511": { YDS: "4918", TD: "43" } } athleteId is the key, stats are the value
			athleteRefs matches those same ids but the value is the proxied URL we use to fetch player details
			categories || [] is a safety net in case the property is missing */
			const statsMap = {}
			const athleteRefs = {}
			const categories = leadersData.categories || []

			/* nested loop, outer loop goes through one category at a time e.g, passing yards so the
			abbreviation is grabbed to match our COLUMNS keys. inner loop hits each player entry
			inside that category's leaders array. ref is the $ref URL string, match() runs the regex
			against it. /athletes\/(\d+)/ finds "athletes/" followed by digits and captures just the digits.
			if nothing matches idMatch is null and we return early. if it matches, idMatch[1] is the athlete ID. */
			categories.forEach(cat => {
				const abbr = cat.abbreviation?.toUpperCase()
				cat.leaders?.forEach(entry => {
					const ref = entry.athlete?.$ref || ''
					const idMatch = ref.match(/athletes\/(\d+)/)
					if (!idMatch) return
					const id = idMatch[1]
					if (!statsMap[id]) statsMap[id] = {}
					if (!athleteRefs[id]) {
						// convert the full $ref URL to our proxied path, strip query params
						athleteRefs[id] = ref.replace('https://sports.core.api.espn.com', '/api/espn')
							.replace(/\?.*$/, '')
					}
					if (abbr && !statsMap[id][abbr]) statsMap[id][abbr] = entry.displayValue
				})
			})

			// step 2: fire all athlete detail fetches at once so they load in parallel not one by one
			const ids = Object.keys(athleteRefs)
			const athletePromises = ids.map(id =>
				fetch(athleteRefs[id])
					.then(r => r.json())
					.catch(() => null)
			)
			const athletes = await Promise.all(athletePromises)

			// step 3: pair each athlete detail with their stats — extract team id from $ref URL
			// and look it up in NFL_TEAMS since ESPN doesn't return abbreviation inline
			const parsed = ids.map((id, i) => {
				const a = athletes[i]
				const teamIdMatch = a?.team?.$ref?.match(/teams\/(\d+)/)
				const teamId = teamIdMatch?.[1]
				return {
					id,
					name:     a?.displayName || '—',
					team:     NFL_TEAMS[teamId] || '—',
					number:   a?.jersey || '—',
					position: a?.position?.abbreviation?.toUpperCase() || '—',
					stats:    statsMap[id]
				}
			}).filter(p => p.name !== '—') // drop any whose detail fetch failed

			setPlayers(parsed)
			const qbs = parsed.filter(p => p.position === 'QB')
			console.log('QB stats sample:', JSON.stringify(qbs[0]?.stats, null, 2))
		} catch (err) {
			console.error(err)
			setError('Failed to load player stats')
		} finally {
			setLoading(false)
		}
	}

	function handleSort(key) {
		if (key === sortKey) {
			setSortDir(d => d === 'desc' ? 'asc' : 'desc')
		} else {
			setSortKey(key)
			setSortDir('desc')
		}
	}

	// filter by position tab and search term, then sort by the active column
	const visible = players
		.filter(p => {
			const matchesTab = activeTab === 'DEF'
				? ['LB', 'DE', 'CB', 'S', 'DT', 'DB'].includes(p.position)
				: p.position === activeTab
			const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
			return matchesTab && matchesSearch
		})
		.sort((a, b) => {
			const va = parseFloat(a.stats[sortKey]) || 0
			const vb = parseFloat(b.stats[sortKey]) || 0
			return sortDir === 'desc' ? vb - va : va - vb
		})

	const cols = COLUMNS[activeTab] || []

	return (
		<div className="stats-container">

			<div className="stats-header">
				<p className="stats-label">{season} Season</p>
				<h2 className="stats-title">Player <span>Stats</span></h2>
			</div>

			{/* season dropdown — defaults to 2025, refetches when changed */}
			<div className="season-select-wrap">
				<select
					className="season-select"
					value={season}
					onChange={e => {
						setSeason(Number(e.target.value))
						setSearch('')
						setSortKey('YDS')
					}}
				>
					{SEASONS.map(yr => (
						<option key={yr} value={yr}>{yr} Season</option>
					))}
				</select>
			</div>

			<div className="stats-tabs">
				{TABS.map(t => (
					<button
						key={t.label}
						className={`stats-tab ${activeTab === t.label ? 'active' : ''}`}
						onClick={() => {
							setActiveTab(t.label)
							setSortKey(t.label === 'DEF' ? 'TOT' : 'YDS')
							setSearch('')
						}}
					>
						{t.label}
					</button>
				))}
			</div>

			<input
				className="stats-search"
				type="text"
				placeholder="Search player..."
				value={search}
				onChange={e => setSearch(e.target.value)}
			/>

			{loading && <div className="status-msg loading-pulse">Loading stats...</div>}
			{error && <div className="status-msg">{error}</div>}

			{!loading && !error && (
				<div className="stats-card">
					<table className="stats-table">
						<thead>
							<tr>
								<th className="col-num">RK</th>
								<th className="col-player">Player</th>
								<th className="col-team">Team</th>
								{cols.map(c => (
									<th
										key={c.key}
										className={`col-stat sortable ${sortKey === c.key ? 'sorted' : ''}`}
										onClick={() => handleSort(c.key)}
									>
										{c.label}
										{sortKey === c.key && (
											<span className="sort-arrow">{sortDir === 'desc' ? '↓' : '↑'}</span>
										)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{visible.map((p, i) => (
								<tr key={p.id} className={i === 0 ? 'first-place' : ''}>
									<td className="col-num">{i + 1}</td>
									<td className="col-player player-name">
										{p.name} <span className="jersey-num">#{p.number}</span>
									</td>
									<td className="col-team">{p.team}</td>
									{cols.map(c => (
										<td key={c.key} className="col-stat">{p.stats[c.key] ?? '—'}</td>
									))}
								</tr>
							))}
							{visible.length === 0 && (
								<tr>
									<td colSpan={cols.length + 3} className="no-results">No players found.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

export default Stats