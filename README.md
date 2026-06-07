# NFLHub

NFL dashboard built with React and ESPN's public API. Started as a standings tracker and grew into a full app with player stats, AI-powered player chat, and a game predictor built on a machine learning model trained on 22 seasons of NFL data.

Live site: https://blitz-five-mauve.vercel.app

---

## Features

- Live NFL standings for both conferences with team colors, season selector going back to 2002, clickable team rows
- Player stats leaderboard — QB, RB, WR, TE, DEF tabs, sortable columns, name search, historical seasons
- Player pages with current season stat blocks, full career table, and an AI chat that actually knows the player's stats
- Team pages with full regular season game logs and opponent logos
- Global player search in the navbar
- Game predictor — pick two teams, get a win probability from an ML model trained on 5,951 games

---

## How it's built

**Frontend** — React, Vite, React Router, plain CSS. No component library.

**Data** — ESPN's public API across two different domains. There's no official documentation so most of the endpoints were figured out from the network tab. The stats API returns athlete data as `$ref` URLs instead of inline data, so fetching the leaderboard is a two-step process — get the leaders list, then fetch all athlete details in parallel with `Promise.all()`.

**CORS** — ESPN blocks direct browser requests. Fixed with a Vite proxy in dev and `vercel.json` rewrites in production.

**AI chat** — Gemini API. The player's bio and full career stats get passed as context so it can answer specific questions about their numbers, not just generic football stuff.

**Game predictor** — full Python pipeline. A script pulls every regular season game from ESPN's scoreboard API from 2002 to 2024 (5,951 games). Feature engineering calculates Elo ratings, offensive and defensive ratings, rest days, and home field advantage for each game using only data that would have been available before kickoff. A logistic regression model trained on those features hits 63.6% accuracy: Vegas oddsmakers typically sit around 65-67% so this is in a reasonable range. A Flask API serves the predictions, proxied through Vite locally.

---

## Run locally

```bash
npm install
npm run dev
```

For the game predictor, run the Flask API in a separate terminal:

```bash
cd predictor
python3 app.py
```
Gemini API key goes in a `.env` file:
```
  VITE_GEMINI_API_KEY=your_key_here
```

## Screenshots
<img width="1470" height="956" alt="Home Page" src="https://github.com/user-attachments/assets/eca0c6bf-72aa-4c52-b611-6813eddf88e9" />

<img width="1470" height="956" alt="Game Predictor" src="https://github.com/user-attachments/assets/31d41c6b-33a4-4a35-bf3a-4b92c2c58d08" />

<img width="1470" height="956" alt="Team Standings" src="https://github.com/user-attachments/assets/6e17357e-29d8-4b8a-8de4-089b28c2031f" />

<img width="1470" height="956" alt="Team Wins/Losses" src="https://github.com/user-attachments/assets/f5efdc07-a921-4623-a42f-95fcf9a4e930" />

<img width="1470" height="956" alt="Player Stats" src="https://github.com/user-attachments/assets/01c3a8d9-75b2-45c1-ad50-e9ae0ee268e3" />

<img width="1470" height="956" alt="Player Page" src="https://github.com/user-attachments/assets/e184f60f-793e-4214-b398-5f87bf08c7d5" /> 

<img width="1470" height="956" alt="AI Component" src="https://github.com/user-attachments/assets/42318b0f-4288-46dc-af12-8b1477bc194d" />

<img width="1470" height="956" alt="Player Search" src="https://github.com/user-attachments/assets/c6e0eb3d-58de-4953-b58f-3372aef7b2cd" />



