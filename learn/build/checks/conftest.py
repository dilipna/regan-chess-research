import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def pytest_report_header(config):
    from impl import IMPL
    return f"Build track: checking the {IMPL}"
