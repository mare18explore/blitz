import { useState, useEffect } from 'react'
import '../styles/Home.css'

function Home() {
	const [articles, setArticles] = useState([])
	const [loading, setLoading]   = useState(true)
	const [error, setError]       = useState(null)
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

	if (loading) return <div className="status-msg loading-pulse">Loading news...</div>
	if (error)   return <div className="status-msg">{error}</div>
  // render a grid of clickable article cards
	return (
		<div className="home-news">

			<div className="home-news-header">
				<p className="home-news-label">NFL Hub</p>
				<h1 className="home-news-title">Latest <span>News</span></h1>
			</div>

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

		</div>
	)
}

export default Home