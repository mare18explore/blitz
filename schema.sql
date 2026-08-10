CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    home_team_id VARCHAR(10) NOT NULL,
    away_team_id VARCHAR(10) NOT NULL,
    home_win_prob NUMERIC(5,2) NOT NULL,
    away_win_prob NUMERIC(5,2) NOT NULL,
    predicted_winner VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);