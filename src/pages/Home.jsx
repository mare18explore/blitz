import { useState, useEffect } from 'react'
import '../styles/Home.css'

// skeleton grid shown while articles load — mirrors the shape of real news cards
function NewsSkeleton() {
	return (
		<div className="news-grid">
			{Array.from({ length: 6 }).map((_, i) => (
				<div key={i} className="news-card-skeleton">
					<div className="skel skel-img"></div>
					<div className="skel-body">
						<div className="skel skel-category"></div>
						<div className="skel skel-headline"></div>
						<div className="skel skel-headline skel-short"></div>
						<div className="skel skel-blurb"></div>
						<div className="skel skel-blurb skel-shorter"></div>
						<div className="skel skel-meta"></div>
					</div>
				</div>
			))}
		</div>
	)
}

// team ids match what ESPN returns — same as NFL_TEAMS in Stats.jsx
const NFL_TEAMS = [
	{ id: '1',  name: 'Atlanta Falcons' },
	{ id: '2',  name: 'Buffalo Bills' },
	{ id: '3',  name: 'Chicago Bears' },
	{ id: '4',  name: 'Cincinnati Bengals' },
	{ id: '5',  name: 'Cleveland Browns' },
	{ id: '6',  name: 'Dallas Cowboys' },
	{ id: '7',  name: 'Denver Broncos' },
	{ id: '8',  name: 'Detroit Lions' },
	{ id: '9',  name: 'Green Bay Packers' },
	{ id: '10', name: 'Tennessee Titans' },
	{ id: '11', name: 'Indianapolis Colts' },
	{ id: '12', name: 'Kansas City Chiefs' },
	{ id: '13', name: 'Las Vegas Raiders' },
	{ id: '14', name: 'Los Angeles Rams' },
	{ id: '15', name: 'Miami Dolphins' },
	{ id: '16', name: 'Minnesota Vikings' },
	{ id: '17', name: 'New England Patriots' },
	{ id: '18', name: 'New Orleans Saints' },
	{ id: '19', name: 'New York Giants' },
	{ id: '20', name: 'New York Jets' },
	{ id: '21', name: 'Philadelphia Eagles' },
	{ id: '22', name: 'Arizona Cardinals' },
	{ id: '23', name: 'Pittsburgh Steelers' },
	{ id: '24', name: 'Los Angeles Chargers' },
	{ id: '25', name: 'San Francisco 49ers' },
	{ id: '26', name: 'Seattle Seahawks' },
	{ id: '27', name: 'Tampa Bay Buccaneers' },
	{ id: '28', name: 'Washington Commanders' },
	{ id: '29', name: 'Carolina Panthers' },
	{ id: '30', name: 'Jacksonville Jaguars' },
	{ id: '33', name: 'Baltimore Ravens' },
	{ id: '34', name: 'Houston Texans' },
]

function GamePredictor() {
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [result, setResult] = useState(null)  // prediction response from Flask
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teams, setTeams] = useState([])  // fetched from ESPN so we get real logos

  // fetch all NFL teams from ESPN when the predictor loads
  useEffect(() => {
    fetch('/api/espn-site/apis/site/v2/sports/football/nfl/teams?limit=40')
      .then(res => res.json())
      .then(data => {
        // ESPN returns teams nested inside sports > leagues > teams
        const raw = data.sports?.[0]?.leagues?.[0]?.teams || []
        // flatten to just what we need — id, name, logo
        const parsed = raw.map(t => ({
          id: String(t.team.id),
          name: t.team.displayName,
          logo: t.team.logos?.[0]?.href || ''
        }))
        // sort alphabetically so the dropdown is easy to scan
        parsed.sort((a, b) => a.name.localeCompare(b.name))
        setTeams(parsed)
        console.log('teams loaded:', parsed.length, parsed[0])
      })
      .catch((err) => {
        console.error('failed to fetch teams', err)
      })
  }, [])

  async function predict() {
    // dont bother if they havent picked both teams yet
    if (!homeId || !awayId) return

    // same team on both sides doesnt make sense
    if (homeId === awayId) {
      setError('Pick two different teams')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // POST to Flask — proxied through Vite so no CORS issues in dev
      const res = await fetch('/api/predictor/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_id: homeId, away_id: awayId })
      })
      const data = await res.json()
      // data comes back as { home_win_prob: 57.4, away_win_prob: 42.6 }
      setResult(data)
    } catch (err) {
      // most likely cause is Flask server not running
      setError('Could not reach predictor — make sure the Flask server is running')
    } finally {
      setLoading(false)
    }
  }

  // look up full team info from the fetched ESPN data
  const homeTeam = teams.find(t => t.id === homeId)
  const awayTeam = teams.find(t => t.id === awayId)
  const homeName = homeTeam?.name || ''
  const awayName = awayTeam?.name || ''
  const homeLogo = homeTeam?.logo || ''
  const awayLogo = awayTeam?.logo || ''

  return (
    <div className="predictor-wrap">

      <div className="predictor-intro">
        <p className="predictor-label">Machine Learning</p>
        <h2 className="predictor-title">Game <span>Predictor</span></h2>
        {/* brief explanation of what the model actually uses */}
        <p className="predictor-subtitle">
          Select a home and away team to get a win probability based on Elo ratings, offensive and defensive ratings, and home field advantage.
        </p>
      </div>

      <div className="predictor-card">
        <div className="matchup-row">

          {/* home team picker */}
          <div className="team-picker">
            <p className="picker-label">Home Team</p>
            <select
              className="team-select"
              value={homeId}
              onChange={e => setHomeId(e.target.value)}
            >
              <option value="">Select team...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="vs-badge">VS</div>

          {/* away team picker */}
          <div className="team-picker">
            <p className="picker-label">Away Team</p>
            <select
              className="team-select"
              value={awayId}
              onChange={e => setAwayId(e.target.value)}
            >
              <option value="">Select team...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* button stays disabled until both teams are picked */}
        <button
          className="predict-btn"
          onClick={predict}
          disabled={!homeId || !awayId || loading}
        >
          {loading ? 'Predicting...' : 'Predict Winner'}
        </button>

        {/* only shows if something went wrong */}
        {error && <p className="predictor-error">{error}</p>}

        {/* result card — winner gets blue prob, loser gets red */}
        {result && (
          <div className="predictor-result">
            <div className={`result-team ${result.home_win_prob > 50 ? 'result-winner' : 'result-loser'}`}>
              {homeLogo && <img src={homeLogo} alt={homeName} className="result-logo" />}
              <p className="result-team-name">{homeName}</p>
              <p className="result-label">Home</p>
              <p className="result-prob">{result.home_win_prob}%</p>
              {result.home_win_prob > 50 && <span className="result-badge winner-badge">Predicted Winner</span>}
              {result.home_win_prob < 50 && <span className="result-badge loser-badge">Predicted Loser</span>}
            </div>
            <div className="result-divider">vs</div>
            <div className={`result-team ${result.away_win_prob > 50 ? 'result-winner' : 'result-loser'}`}>
              {awayLogo && <img src={awayLogo} alt={awayName} className="result-logo" />}
              <p className="result-team-name">{awayName}</p>
              <p className="result-label">Away</p>
              <p className="result-prob">{result.away_win_prob}%</p>
              {result.away_win_prob > 50 && <span className="result-badge winner-badge">Predicted Winner</span>}
              {result.away_win_prob < 50 && <span className="result-badge loser-badge">Predicted Loser</span>}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function Home() {
	const [articles, setArticles] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [activeTab, setActiveTab] = useState('news') // 'news' or 'predictor'

	// fetch latest NFL news from ESPN on mount
	useEffect(() => {
		fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20')
			.then(res => res.json())
			.then(data => {
				console.log('news sample:', JSON.stringify(data.articles?.[0], null, 2))
				setArticles(data.articles || [])
				setLoading(false)
			})
			.catch(() => {
				setError('Failed to load news')
				setLoading(false)
			})
	}, [])

	return (
		<div className="home-news">

			<div className="home-news-header">
				<p className="home-news-label">NFL Hub</p>
				<h1 className="home-news-title">Latest <span>News</span></h1>
			</div>

			{/* tab switcher — reuses stats-tab style from Stats.css so it matches */}
			<div className="home-tabs">
				<button
					className={`stats-tab ${activeTab === 'news' ? 'active' : ''}`}
					onClick={() => setActiveTab('news')}
				>
					Latest News
				</button>
				<button
					className={`stats-tab ${activeTab === 'predictor' ? 'active' : ''}`}
					onClick={() => setActiveTab('predictor')}
				>
					Game Predictor
				</button>
			</div>

			{/* news tab */}
			{activeTab === 'news' && (
				<>
					{loading && <NewsSkeleton />}
					{error && <div className="status-msg">{error}</div>}
					{!loading && !error && (
						<div className="news-grid">
							{articles.map(article => (
                  <a
									key={article.dataSourceIdentifier || article.id}
                  href={article.links?.web?.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
								>
									{article.images?.[0]?.url && (
										<img
											src={article.images[0].url}
											alt={article.headline}
											className="news-img"
										/>
									)}
									<div className="news-body">
										<p className="news-category">{article.categories?.[0]?.description || 'NFL'}</p>
										<h2 className="news-headline">{article.headline}</h2>
										<p className="news-blurb">{article.description}</p>
										<p className="news-meta">
											{article.byline && <span>{article.byline} · </span>}
											{article.published && (
												<span>{new Date(article.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
											)}
										</p>
									</div>
								</a>
							))}
						</div>
					)}
				</>
			)}

			{/* predictor tab  wired to Flask API */}
			{activeTab === 'predictor' && <GamePredictor />}

		</div>
	)
}

export default Home