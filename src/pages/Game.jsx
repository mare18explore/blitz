import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/Game.css'

// ESPN's stat keys are ugly so map them to readable labels
// order here is the order they show up in the table
const STAT_ROWS = [
	['firstDowns',          'First Downs'],
	['totalYards',          'Total Yards'],
	['netPassingYards',     'Passing Yards'],
	['rushingYards',        'Rushing Yards'],
	['yardsPerPlay',        'Yards Per Play'],
	['thirdDownEff',        'Third Down'],
	['fourthDownEff',       'Fourth Down'],
	['totalPenaltiesYards', 'Penalties'],
	['turnovers',           'Turnovers'],
	['sacksYardsLost',      'Sacks Allowed'],
	['possessionTime',      'Time of Possession'],
]

function Game() {
	const { id } = useParams()        // grabs the :id from the URL e.g. /game/401772936
	const navigate = useNavigate()

	const [game, setGame] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		fetchGameData()

		// poll so live box scores keep updating, same idea as the schedule page
		const timer = setInterval(fetchGameData, 60000)
		return () => clearInterval(timer)
	}, [id]) // re-fetch if the id in the URL changes

	async function fetchGameData() {
		setError(null)

		try {
			// goes through Flask rather than ESPN directly, safari gets 403'd otherwise
			const res = await fetch(`/api/predictor/game/${id}`)
			const data = await res.json()
			setGame(data)
		} catch (err) {
			console.error(err)
			setError('Failed to load game data')
		} finally {
			setLoading(false)
		}
	}

	if (loading) return <div className="status-msg loading-pulse">Loading game...</div>
	if (error)   return <div className="status-msg">{error}</div>
	if (!game || !game.teams?.length) return <div className="status-msg">Game not found.</div>

	// the boxscore lists both teams but doesnt say which is home, the scores object does
	const [first, second] = game.teams
	const firstIsHome = game.scores?.[first.id]?.homeAway === 'home'
	const home = firstIsHome ? first : second
	const away = firstIsHome ? second : first

	const homeScore = game.scores?.[home.id]?.score
	const awayScore = game.scores?.[away.id]?.score

	// only call a winner once the game is actually over
	const finished = game.state === 'post'
	const homeWon  = finished && Number(homeScore) > Number(awayScore)
	const awayWon  = finished && Number(awayScore) > Number(homeScore)

	// before kickoff the status text is just a date, same as the schedule cards
	const statusText = game.state === 'pre'
		? new Date(game.date).toLocaleString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			})
		: game.detail

	return (
		<div className="game-container">

			{/* back button */}
			<button className="back-btn" onClick={() => navigate(-1)}>
				← Back to Schedule
			</button>

			{/* scoreline across the top, away on the left like every scoreboard */}
			<div className="game-header">

				<div className={`game-team ${awayWon ? 'game-winner' : ''}`}>
					{away.logo && <img src={away.logo} alt={away.name} className="game-logo" />}
					<p className="game-team-name">{away.name}</p>
					<p className="game-team-label">Away</p>
				</div>

				<div className="game-score-wrap">
					{game.state === 'pre'
						? <p className="game-vs">VS</p>
						: <p className="game-score">{awayScore} <span>-</span> {homeScore}</p>
					}
					<p className={`game-status ${game.state === 'in' ? 'game-live' : ''}`}>
						{game.state === 'in' && <span className="live-dot loading-pulse"></span>}
						{statusText}
					</p>
				</div>

				<div className={`game-team ${homeWon ? 'game-winner' : ''}`}>
					{home.logo && <img src={home.logo} alt={home.name} className="game-logo" />}
					<p className="game-team-name">{home.name}</p>
					<p className="game-team-label">Home</p>
				</div>
			</div>

			{/* ESPN doesnt populate the boxscore until kickoff so theres nothing to show yet */}
			{game.state === 'pre' ? (
				<div className="status-msg">Team stats available once the game starts.</div>
			) : (
				<div className="game-stats-wrap">
					<p className="section-label">Team Stats</p>

					<div className="game-stats-table">
						{STAT_ROWS.map(([key, label]) => {
							const awayVal = away.stats?.[key]
							const homeVal = home.stats?.[key]
							// skip rows ESPN didnt return rather than showing a row of dashes
							if (awayVal === undefined && homeVal === undefined) return null

							return (
								<div key={key} className="game-stat-row">
									<span className="game-stat-value">{awayVal ?? '—'}</span>
									<span className="game-stat-label">{label}</span>
									<span className="game-stat-value">{homeVal ?? '—'}</span>
								</div>
							)
						})}
					</div>
				</div>
			)}

		</div>
	)
}

export default Game