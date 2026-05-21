import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import '../styles/Navbar.css'

// Navigation component - shows on every page via App.jsx
function Navigation() {
  const [searchOpen, setSearchOpen] = useState(false)  // controls if search bar is visible
  const [query, setQuery] = useState('')               // what the user is typing
  const [results, setResults] = useState([])           // matched players to show
  const [players, setPlayers] = useState([])           // full player list, fetched once
  const inputRef = useRef(null)                        // so we can focus the input when search opens
  const navigate = useNavigate()

  // fetch the leaders list once when search is first opened
  // same data as the stats page so no extra API calls
  useEffect(() => {
    if (!searchOpen || players.length > 0) return
    fetchPlayers()
  }, [searchOpen])

  async function fetchPlayers() {
    try {
      const leadersRes = await fetch(
        "/api/espn/v2/sports/football/leagues/nfl/seasons/2025/types/2/leaders"
      )
      const leadersData = await leadersRes.json()

      const statsMap = {}
      const athleteRefs = {}
      const categories = leadersData.categories || []

      categories.forEach(cat => {
        cat.leaders?.forEach(entry => {
          const ref = entry.athlete?.$ref || ""
          const idMatch = ref.match(/athletes\/(\d+)/)
          if (!idMatch) return
          const id = idMatch[1]
          if (!athleteRefs[id]) {
            athleteRefs[id] = ref
              .replace("https://sports.core.api.espn.com", "/api/espn")
              .replace("http://sports.core.api.espn.com", "/api/espn")
              .replace(/\?.*$/, "")
          }
        })
      })

      const ids = Object.keys(athleteRefs)
      const athletePromises = ids.map(id =>
        fetch(athleteRefs[id])
          .then(r => r.json())
          .catch(() => null)
      )
      const athletes = await Promise.all(athletePromises)

      const parsed = ids.map((id, i) => {
        const a = athletes[i]
        return {
          id,
          name:     a?.displayName || "",
          position: a?.position?.abbreviation?.toUpperCase() || "",
          team:     a?.team?.$ref?.match(/teams\/(\d+)/)?.[1] || ""
        }
      }).filter(p => p.name)

      setPlayers(parsed)
    } catch (err) {
      console.error("search fetch failed:", err)
    }
  }

  // focus the input whenever the search bar opens
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  function handleQuery(e) {
    const val = e.target.value
    setQuery(val)
    if (!val.trim()) {
      setResults([])
      return
    }
    // filter players by name as the user types
    const matched = players.filter(p =>
      p.name.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 6) // cap at 6 results so the dropdown doesnt get huge
    setResults(matched)
  }

  function handleSelect(player) {
    navigate(`/player/${player.id}`)
    setSearchOpen(false)
    setQuery("")
    setResults([])
  }

  function handleClose() {
    setSearchOpen(false)
    setQuery("")
    setResults([])
  }

  return (
    <nav className="navbar">
      {/* logo on the left - clicking it goes home */}
      <Link to="/" className="navbar-logo">
        <div className="logo-icon">NFL</div>
        <div className="logo-text">
          <span className="logo-nfl">NFL</span>
          <span className="logo-hub">Hub</span>
        </div>
      </Link>

      {/* nav links and search on the right */}
      <div className="navbar-right">
        {!searchOpen && (
          <div className="navbar-links">
            <NavLink to="/standings">Standings</NavLink>
            <NavLink to="/stats">Player Stats</NavLink>
          </div>
        )}

        {/* search bar — slides in when the icon is clicked */}
        {searchOpen && (
          <div className="search-wrap">
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              placeholder="Search player..."
              value={query}
              onChange={handleQuery}
              onKeyDown={e => e.key === "Escape" && handleClose()}
            />
            <button className="search-close" onClick={handleClose}>✕</button>

            {/* dropdown results */}
            {results.length > 0 && (
              <div className="search-results">
                {results.map(p => (
                  <div
                    key={p.id}
                    className="search-result-row"
                    onClick={() => handleSelect(p)}
                  >
                    <span className="search-result-name">{p.name}</span>
                    <span className="search-result-meta">{p.position}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* search icon button */}
        <button
          className="search-icon-btn"
          onClick={() => setSearchOpen(o => !o)}
          aria-label="Search players"
        >
          🔍
        </button>
      </div>
    </nav>
  )
}

export default Navigation