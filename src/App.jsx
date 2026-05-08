import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Standings from './pages/Standings'
import Home from './pages/Home'
import Stats from './pages/Stats'
import Player from './pages/Player'
import './styles/Navbar.css'

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/stats" element={<Stats/>} /> 
          <Route path="/player/:id" element={<Player />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App