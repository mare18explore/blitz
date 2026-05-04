import { Link } from 'react-router-dom'
import '../styles/Home.css'

// Home page - first thing users see when they visit the app
function Home() {
  return (
    <div className="home">
      <div className="home-content">

        {/* small label above the title */}
        <p className="home-label">Your NFL Dashboard</p>

        {/* main headline - span makes "every game" blue */}
        <h1 className="home-title">
          Stay on top of <span>every game</span>
        </h1>

        {/* short description */}
        <p className="home-sub">
          Live standings, player stats, and more — all in one place.
        </p>

        {/* two buttons linking to the main pages */}
        <div className="home-buttons">
          <Link to="/standings" className="btn-primary">View Standings</Link>
          <Link to="/stats" className="btn-secondary">Player Stats</Link>
        </div>

      </div>
    </div>
  )
}

export default Home