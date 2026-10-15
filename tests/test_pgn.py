from analyzer.chesscore.pgn import parse_pgn_text

PGN = """[Event "Rated Rapid game"]
[Site "https://lichess.org/abcd1234"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[WhiteElo "1650"]
[BlackElo "1712"]
[TimeControl "600+0"]

1. e4 { [%clk 0:10:00] } e5 { [%clk 0:09:58] } 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 1-0

[Event "Second"]
[White "c"]
[Black "d"]
[Result "*"]

1. d4 d5 *
"""


def test_parse_two_games():
    gs = parse_pgn_text(PGN)
    assert len(gs) == 2
    g = gs[0]
    assert g.game_id == "li_abcd1234"
    assert g.white_elo == 1650 and g.black_elo == 1712
    assert g.moves_uci[:2] == ["e2e4", "e7e5"]
    assert len(g.fens) == len(g.moves_uci) + 1
    assert g.clocks[0] == 600.0
    assert gs[1].white_elo is None


def test_illegal_game_skipped():
    bad = '[Event "x"]\n\n1. e4 e5 2. Ke3 Ke6 3. Qh8 *\n'
    assert parse_pgn_text(bad) == []
