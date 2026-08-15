#!/usr/bin/env python3
"""macOS portability audit for the mobile-app-builder shipping scripts.

Every check carries a positive control: a line that MUST match. If the control
fails, the check is reported BLIND rather than clean — a scanner that silently
stops matching reports everything as fine, which is worse than not running it.
(That is not hypothetical: the first version of this audit had a mangled
`sed -i` pattern and reported [ok] against a file that contained the defect.)

macOS ships bash 3.2.57, BSD userland (sed/grep/stat/date/readlink/find), and
no timeout(1). Those are the constraints being checked.
"""
import re
import sys
import pathlib

CHECKS = [
    # (label, regex, why it breaks on macOS, positive-control line)
    ("sed -i without ''", r"\bsed\s+-i\s+(?!'')",
     "BSD sed requires an explicit backup suffix: sed -i '' ",
     "sed -i 's/a/b/' file.txt"),
    ("timeout(1)", r"(?<![\w./-])timeout\s+\d",
     "not shipped on macOS (coreutils gtimeout only)",
     "timeout 30 echo hi"),
    ("grep -P", r"\bgrep\b[^|;&\n]*\s-\w*P",
     "BSD grep has no PCRE support",
     "grep -P '\\d+' file"),
    ("readlink -f", r"\breadlink\s+-\w*f",
     "BSD readlink has no -f",
     "readlink -f ."),
    ("stat -c", r"\bstat\s+-\w*c",
     "BSD stat uses -f, not -c",
     "stat -c %s file"),
    ("date -d", r"\bdate\s+-d\b",
     "BSD date has no -d",
     "date -d yesterday"),
    ("find -printf", r"\bfind\b[^|;&\n]*-printf",
     "GNU find only",
     "find . -printf '%p'"),
    ("sha1sum/sha256sum", r"\bsha(1|256)sum\b",
     "macOS ships shasum, not these",
     "sha256sum file"),
    ("base64 -w", r"\bbase64\s+-w",
     "GNU coreutils only",
     "base64 -w0 file"),
    ("cp -u", r"\bcp\s+-\w*u",
     "absent on older macOS cp",
     "cp -u a b"),
    ("env -u", r"\benv\s+-u\b",
     "flag support diverges between GNU and BSD env",
     "env -u CI echo"),
    ("sort -V", r"\bsort\b[^|;&\n]*\s-\w*V",
     "unreliable on BSD sort",
     "sort -V versions.txt"),
    ("xargs -r", r"\bxargs\s+-\w*r",
     "GNU only",
     "xargs -r rm"),
    ("mktemp long opts", r"\bmktemp\s+--",
     "GNU long options",
     "mktemp --tmpdir=/tmp x"),
    ("bash4 ${v,,} / ${v^^}", r"\$\{[A-Za-z_][A-Za-z0-9_]*(,,|\^\^)",
     "bash 4 case conversion; macOS ships 3.2",
     'echo "${var,,}"'),
    ("bash4 declare -A", r"\bdeclare\s+-A\b",
     "bash 4 associative arrays",
     "declare -A m"),
    ("bash4 mapfile/readarray", r"\b(mapfile|readarray)\b",
     "bash 4",
     "mapfile -t arr < f"),
    ("bash4 globstar", r"shopt\s+-s\s+globstar",
     "bash 4",
     "shopt -s globstar"),
    ("bash4 &>> redirect", r"&>>",
     "bash 4",
     "cmd &>> log"),
    ("bash4 ;;& in case", r";;&",
     "bash 4 case fallthrough",
     "a) x ;;&"),
    # Narrowed deliberately. The first version flagged `git --version` and
    # `brew --version`, which are cross-platform tools that support the flag
    # everywhere — a false positive. Only tools whose macOS build is BSD and
    # errors on --version belong here.
    ("--version on a BSD tool",
     r"\b(sed|grep|awk|date|stat|readlink|find|tar|head|tail|sort|uniq|wc|du|df|xargs)\s+--version",
     "the macOS build of these is BSD and errors on --version",
     "sed --version"),
]


def strip_comments(text):
    """Drop shell comments so a comment ABOUT a construct isn't read as usage.

    This mattered twice today: a check for `env -u` and a check for `cp -u`
    both fired on the comments explaining why those are avoided.
    """
    out = []
    for line in text.splitlines():
        s = line.lstrip()
        if s.startswith("#"):
            continue
        out.append(re.sub(r"\s+#(?!\{).*$", "", line))
    return "\n".join(out)


def main(root):
    files = sorted(pathlib.Path(root).glob("scripts/*.sh"))
    if not files:
        print(f"no scripts found under {root}", file=sys.stderr)
        return 2
    bodies = {f: strip_comments(f.read_text()) for f in files}

    blind, hits = [], []
    for label, pattern, why, control in CHECKS:
        rx = re.compile(pattern)
        if not rx.search(control):
            blind.append((label, control))
            continue
        found = []
        for f, body in bodies.items():
            for i, line in enumerate(body.splitlines(), 1):
                if rx.search(line):
                    found.append(f"{f.name}:{i}: {line.strip()}")
        if found:
            hits.append((label, why, found))
        else:
            print(f"[ok]    {label}")

    for label, why, found in hits:
        print(f"\n[BREAK] {label} — {why}")
        for h in found:
            print(f"        {h}")
    for label, control in blind:
        print(f"\n[BLIND] {label} — control line did not match; check is untrustworthy")
        print(f"        control: {control}")

    print(f"\nfiles scanned: {len(files)}   breaks: {len(hits)}   blind: {len(blind)}")
    return 1 if (hits or blind) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
