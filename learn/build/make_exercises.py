"""Create the exercise files from the reference solutions.

Every block between "# TODO(n): ..." and "# END TODO" in solutions/*.py becomes the TODO comment plus
`raise NotImplementedError`. Existing exercise files are never overwritten (they hold your work) unless you pass
--force, which first copies the old file to <name>.py.bak.

    python make_exercises.py            # create any missing exercise files
    python make_exercises.py --force    # reset every exercise (keeps a .bak of each)
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TODO = re.compile(r"^(\s*)# TODO\(([\d.]+)\)")


def blank(src: str) -> str:
    out, lines, i = [], src.splitlines(), 0
    while i < len(lines):
        m = TODO.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue
        indent, tag = m.group(1), m.group(2)
        while i < len(lines) and lines[i].strip().startswith("#") and "END TODO" not in lines[i]:
            out.append(lines[i])            # keep the instructions
            i += 1
        while i < len(lines) and "# END TODO" not in lines[i]:
            i += 1                          # drop the solution
        out.append(f'{indent}raise NotImplementedError("TODO({tag})")')
        i += 1                              # drop the END TODO marker
    return "\n".join(out) + "\n"


def main(force: bool) -> None:
    for sol in sorted((ROOT / "solutions").glob("s*.py")):
        dst = ROOT / sol.name
        if dst.exists() and not force:
            print(f"kept      {dst.name} (already exists)")
            continue
        if dst.exists():
            shutil.copy(dst, dst.with_suffix(".py.bak"))
        dst.write_text(blank(sol.read_text(encoding="utf-8")), encoding="utf-8")
        print(f"wrote     {dst.name}")


if __name__ == "__main__":
    main("--force" in sys.argv)
