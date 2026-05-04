import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Standings from './components/Standings'
import Home from './pages/Home'
import './styles/Navbar.css'

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/stats" element={<h1 style={{ color: '#f0f0f0', padding: '32px' }}>Player Stats Coming Soon</h1>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App