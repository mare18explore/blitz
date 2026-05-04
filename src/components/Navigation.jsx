import { Link } from 'react-router-dom'
import '../styles/Navbar.css'

// Navigation component - shows on every page via App.jsx
function Navigation() {
  return (
    <nav className="navbar">

      {/* logo on the left - clicking it could go home later */}
      <div className="navbar-logo">
        <div className="logo-icon">NFL</div>
        <div className="logo-text">
          <span className="logo-nfl">NFL</span>
          <span className="logo-hub">Hub</span>
        </div>
      </div>

      {/* nav links on the right */}
      <div className="navbar-links">
        <Link to="/standings">Standings</Link>
        <Link to="/stats">Player Stats</Link>
      </div>

    </nav>
  )
}

export default Navigation