import app
from app import get_recent_avg
from app import get_elo

def test_get_recent_avg_with_string_key():
  data = {"5": [20, 24, 17, 30]}
  result = get_recent_avg("5", data)
  # average of 20,24,17,30
  assert result == 22.75  

def test_get_recent_avg_with_int_key():
  data = {5: [20, 24, 17, 30]}
  result = get_recent_avg(5, data)
  assert result == 22.75

def test_get_recent_avg_missing_team_returns_default():
  data = {}
  result = get_recent_avg("999", data)
  # fallback default
  assert result == 21.0

def test_get_recent_avg_only_uses_last_four_games():
  data = {"5": [100, 100, 100, 20, 24, 17, 30]}
  result = get_recent_avg("5", data)
  # 7 games, ignores first 3
  assert result == 22.75

def test_get_elo_with_string_key():
  # temporarily point at a fake elo_ratings dict for this test
  app.elo_ratings = {"5": 1550}
  result = get_elo("5")
  assert result == 1550

def test_get_elo_with_int_key():
  app.elo_ratings = {5: 1600}
  result = get_elo(5)
  assert result == 1600

def test_get_elo_missing_team_returns_default():
  app.elo_ratings = {}
  result = get_elo("999")
  assert result == 1500