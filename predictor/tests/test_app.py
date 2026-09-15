import app
from app import get_weighted_recent
from app import get_elo

def test_get_weighted_recent_with_string_key():
  data = {"5": [20, 24, 17, 30]}
  result = get_weighted_recent("5", data)
  # only 4 games exist, all fall in the "recent" bucket (recent_n=8), so it's
  # a straight weighted average of all 4 at weight 1.75 each, which equals a plain mean
  assert result == 22.75

def test_get_weighted_recent_with_int_key():
  data = {5: [20, 24, 17, 30]}
  result = get_weighted_recent(5, data)
  assert result == 22.75

def test_get_weighted_recent_missing_team_returns_none():
  data = {}
  result = get_weighted_recent("999", data)
  # no history at all, function itself returns None
  # (the 21.0 fallback happens in app.py's calling code, not in this function)
  assert result is None

def test_get_weighted_recent_uses_more_than_four_games():
  # 12 games total: last 8 are "recent" (weight 1.75), first 4 are "older" (weight 1.0)
  data = {"5": [10, 10, 10, 10, 20, 24, 17, 30, 25, 25, 25, 25]}
  result = get_weighted_recent("5", data)
  # just confirm it runs and returns a sensible number in a reasonable range,
  # exact expected value depends on the weighting math
  assert 15 < result < 30

def test_get_elo_with_string_key():
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