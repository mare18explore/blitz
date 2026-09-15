import { useState, useEffect } from 'react'
import '../styles/Schedule.css'
import { useNavigate } from 'react-router-dom'


function WeeklySchedule() {
	const [games, setGames] = useState([])
	const [week, setWeek] = useState(null)  // espn tells us which week we're in
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const navigate = useNavigate()

	// grab the scoreboard through flask, same reason as the teams fetch
	// safari gets 403'd calling espn directly so it goes server side
	useEffect(() => {
		// guards against setting state after the tab gets switched away
		let cancelled = false

		function load() {
			fetch('/api/predictor/scoreboard')
				.then(res => res.json())
				.then(data => {
					if (cancelled) return
					// flask already trimmed this down to just the fields we need
					setGames(data.games || [])
					setWeek(data.week)
					setError(null)
					setLoading(false)
				})
				.catch(err => {
					console.error('failed to load scoreboard', err)
					if (cancelled) return
					setError('Could not load this weeks games')
					setLoading(false)
				})
		}

		load()
		// refresh every minute so live scores dont sit stale during sunday games
		const timer = setInterval(load, 60000)

		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [])

	if (loading) return <div className="status-msg">Loading games...</div>
	if (error) return <div className="status-msg">{error}</div>
	// happens in the dead weeks between the super bowl and preseason
	if (!games.length) return <div className="status-msg">No games scheduled right now.</div>

	return (
		<div className="schedule-wrap">

			<div className="schedule-intro">
				<p className="schedule-label">Scoreboard</p>
				<h2 className="schedule-title">Week <span>{week}</span></h2>
			</div>

			<div className="schedule-grid">
				{games.map(game => {
					// espn sends scores back as strings so they need converting to compare
					const finished = game.state === 'post'
					const homeScore = Number(game.home.score)
					const awayScore = Number(game.away.score)
					const homeWon = finished && homeScore > awayScore
					const awayWon = finished && awayScore > homeScore

					// before kickoff espn's status text is just a date string, so build our own
					const statusText = game.state === 'pre'
						? new Date(game.date).toLocaleString('en-US', {
								weekday: 'short',
								hour: 'numeric',
								minute: '2-digit'
							})
						: game.detail

					return (
						<div 
              key={game.id} 
              className="schedule-card"
              onClick={() => navigate(`/game/${game.id}`)}
            >

							{/* live games get a pulsing dot so you can spot them at a glance */}
              <p className={`schedule-status ${game.state === 'in' ? 'schedule-live' : ''}`}>
              {game.state === 'in' && <span className="live-dot loading-pulse"></span>}
              {statusText}
              </p>

							{/* away listed first to match how espn and most scoreboards show it */}
							<div className={`schedule-team ${awayWon ? 'schedule-winner' : ''}`}>
								{game.away.logo && <img src={game.away.logo} alt={game.away.name} className="schedule-logo" />}
								<span className="schedule-name">{game.away.name}</span>
								{game.away.record && <span className="schedule-record">{game.away.record}</span>}
								{/* no point showing a 0 before the game has started */}
								{game.state !== 'pre' && <span className="schedule-score">{game.away.score}</span>}
							</div>

							<div className={`schedule-team ${homeWon ? 'schedule-winner' : ''}`}>
								{game.home.logo && <img src={game.home.logo} alt={game.home.name} className="schedule-logo" />}
								<span className="schedule-name">{game.home.name}</span>
								{game.home.record && <span className="schedule-record">{game.home.record}</span>}
								{game.state !== 'pre' && <span className="schedule-score">{game.home.score}</span>}
							</div>

						</div>
					)
				})}
			</div>
		</div>
	)
}

export default WeeklySchedule