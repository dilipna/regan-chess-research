"""Keeps the Build-it track honest: every learner check must pass against the reference solutions."""
import os
import subprocess
import sys
from pathlib import Path

BUILD = Path(__file__).resolve().parents[1] / "learn" / "build"


def test_reference_solutions_pass_every_check():
    env = {**os.environ, "BUILD_IMPL": "solutions"}
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], cwd=BUILD, env=env,
                       capture_output=True, text=True, timeout=600)
    assert r.returncode == 0, r.stdout[-3000:] + r.stderr[-2000:]


def test_exercises_are_the_solutions_with_the_todos_blanked():
    sys.path.insert(0, str(BUILD))
    from make_exercises import blank
    for sol in sorted((BUILD / "solutions").glob("s*.py")):
        text = sol.read_text(encoding="utf-8")
        assert text.count("# TODO(") == text.count("# END TODO"), sol.name
        assert "NotImplementedError" in blank(text)
        compile(blank(text), sol.name, "exec")
