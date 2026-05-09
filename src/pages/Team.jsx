import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/Team.css'

function Team() {
	// grabs both :id and :season from the URL
    const { id, season, record } = useParams()
	const navigate = useNavigate()

	const [team, setTeam] = useState(null)
	const [schedule, setSchedule] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		fetchTeamData()
	}, [id, season]) // re-fetch if either the team or season changes

	async function fetchTeamData() {
		setLoading(true)
		setError(null)

		try {
			// fetch team info and schedule in parallel since they don't depend on each other
			const [teamRes, scheduleRes] = await Promise.all([
				fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}`),
				fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/schedule?season=${season}`)
			])

			const teamData     = await teamRes.json()
			const scheduleData = await scheduleRes.json()

			// team info sits one level deep inside the response
			setTeam(teamData.team)

			// events is the array of games — filter to only regular season (seasonType 2)
			// each event has competitors array where we find the opponent and the result
			const games = (scheduleData.events || []).filter(e =>
				e.seasonType?.type === 2 || e.season?.slug === 'regular-season'
			)
			setSchedule(games)
		} catch (err) {
			console.error(err)
			setError('Failed to load team data')
		} finally {
			setLoading(false)
		}
	}

	if (loading) return <div className="status-msg loading-pulse">Loading team...</div>
	if (error)   return <div className="status-msg">{error}</div>
	if (!team)   return <div className="status-msg">Team not found.</div>

	// pull out what we need from the team object
	const logo     = team.logos?.[0]?.href
	const name     = team.displayName
	const color    = `#${team.color}` || '#3b82f6'

	return (
		<div className="team-container">

			{/* back button */}
			<button className="back-btn" onClick={() => navigate(-1)}>
				← Back to Standings
			</button>

			{/* team header card */}
			<div className="team-card" style={{ borderColor: color }}>
				<div className="team-card-left">
					{logo && <img src={logo} alt={name} className="team-logo-large" />}
				</div>
				<div className="team-card-right">
					<h1 className="team-name-large">{name}</h1>
					<p className="team-season-label">{season} Season</p>
					<div className="team-record-wrap">
						<span className="team-record">{record}</span>
						<span className="team-record-label">Record</span>
					</div>
				</div>
			</div>

			{/* game log */}
			<div className="gamelog-wrap">
				<p className="section-label">Game Log</p>
				<div className="gamelog-card">
					<table className="gamelog-table">
						<thead>
							<tr>
								<th>Week</th>
								<th>Date</th>
								<th>Opponent</th>
								<th>Result</th>
								<th>Score</th>
							</tr>
						</thead>
						<tbody>
							{schedule.map((game, i) => {
								// each game has a competitors array with 2 teams — find the opponent
								const competitors = game.competitions?.[0]?.competitors || []
								const opponent    = competitors.find(c => c.team?.id !== id)
								const thisTeam    = competitors.find(c => c.team?.id === id)

								const opponentName = opponent?.team?.shortDisplayName || '—'
								const opponentLogo = opponent?.team?.logos?.[0]?.href
								const homeAway     = thisTeam?.homeAway === 'home' ? 'vs' : '@'

								// score and result
								const thisScore = thisTeam?.score?.displayValue || thisTeam?.score || '—'
								const oppScore  = opponent?.score?.displayValue  || opponent?.score  || '—'
								const winner    = thisTeam?.winner

								// format the date nicely
								const date = game.date
									? new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
									: '—'

								const week = game.week?.number || i + 1

								return (
									<tr key={game.id} className={winner === true ? 'win-row' : winner === false ? 'loss-row' : ''}>
										<td className="week-col">{week}</td>
										<td className="date-col">{date}</td>
										<td className="opponent-col">
											{opponentLogo && (
												<img src={opponentLogo} alt={opponentName} className="opp-logo" />
											)}
											<span>{homeAway} {opponentName}</span>
										</td>
										<td className={`result-col ${winner === true ? 'win' : winner === false ? 'loss' : ''}`}>
											{winner === true ? 'W' : winner === false ? 'L' : '—'}
										</td>
										<td className="score-col">{thisScore} - {oppScore}</td>
									</tr>
								)
							})}
							{schedule.length === 0 && (
								<tr>
									<td colSpan="5" className="no-results">No games found.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}

export default Team