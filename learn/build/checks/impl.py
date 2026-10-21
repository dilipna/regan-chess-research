"""Load the learner's exercise modules (default) or the reference solutions (BUILD_IMPL=solutions)."""
import importlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPL = os.environ.get("BUILD_IMPL", "exercises")
DIR = ROOT / "solutions" if IMPL == "solutions" else ROOT
if str(DIR) not in sys.path:
    sys.path.insert(0, str(DIR))
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))   # shared helpers such as data.py


def load(name: str):
    return importlib.import_module(name)
