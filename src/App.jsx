import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Standings from './pages/Standings'
import Home from './pages/Home'
import Stats from './pages/Stats'
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
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App