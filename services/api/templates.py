"""Narrow, anchored language grammar and validated literal recipe parameters.

No similarity search: unconsumed qualifiers abstain instead of silently dropping
constraints. Templates are explicit supported operations, not fake model output.
"""

import re
import shlex
from dataclasses import dataclass

from .schemas import Intent, Profile, Recipe, RecipeParameter


@dataclass(frozen=True)
class TemplateResult:
    command: str
    intent: Intent
    assumptions: list[str]


def literal(value: str) -> str:
    if not value or len(value) > 240 or any(ord(c) < 32 for c in value):
        raise ValueError(
            "Parameters must be 1–240 characters with no control characters"
        )
    return shlex.quote(value)


def path(value: str) -> str:
    literal(value)
    if value.startswith(("~", "-")) or any(c in value for c in "$`*?[]{};|&<>\\"):
        raise ValueError(
            "Use a literal relative or absolute path; no expansions or shell operators"
        )
    return literal(value)


def number(value: str, maximum: int = 1_000_000_000) -> int:
    if not re.fullmatch(r"[1-9][0-9]{0,9}", value) or int(value) > maximum:
        raise ValueError(f"Enter a positive whole number no larger than {maximum}")
    return int(value)


def param(name, label, default):
    return RecipeParameter(name=name, label=label, default=default)


def recipe(
    id, title, category, description, request, command, parameters=(), linux=False
):
    return Recipe(
        id=id,
        title=title,
        category=category,
        description=description,
        request=request,
        command=command,
        parameters=list(parameters),
        profiles=["linux"] if linux else ["linux", "macos"],
        compatibility="GNU findutils on GNU/Linux."
        if linux
        else "Bash with standard GNU/Linux or macOS utilities; check your installed version.",
    )


RECIPES = [
    recipe(
        "large-files",
        "Find the space takers",
        "File search",
        "Recursively list regular files strictly larger than a threshold in binary MiB.",
        "Find files larger than 100 MiB in the current directory",
        "find . -type f -size +100M",
        [
            param("path", "Starting directory", "."),
            param("size", "Threshold (MiB)", "100"),
        ],
        linux=True,
    ),
    recipe(
        "exact-bytes",
        "Count every byte",
        "File search",
        "Find regular files with an exact byte count. No block rounding.",
        "Find files exactly 1024 bytes in the current directory",
        "find . -type f -size 1024c",
        [
            param("path", "Starting directory", "."),
            param("size", "Exact size (bytes)", "1024"),
        ],
        linux=True,
    ),
    recipe(
        "named-files",
        "Follow a filename",
        "File search",
        "Recursively match a quoted filename pattern, including hidden directories.",
        'Find files named "*.log" in the current directory',
        "find . -type f -name '*.log'",
        [
            param("path", "Starting directory", "."),
            param("pattern", "Filename pattern", "*.log"),
        ],
    ),
    recipe(
        "directories",
        "See the directory structure",
        "File search",
        "List directories recursively, starting at a literal path.",
        "Find directories in the current directory",
        "find . -type d",
        [param("path", "Starting directory", ".")],
    ),
    recipe(
        "pwd",
        "Get your bearings",
        "Navigation",
        "Print the current working directory. The result is not read by ShellForge.",
        "Show the current working directory",
        "pwd",
    ),
    recipe(
        "list",
        "Look around",
        "Navigation",
        "List a directory in long format, including hidden entries; no recursion.",
        "List all files in the current directory",
        "ls -la -- .",
        [param("path", "Directory", ".")],
    ),
    recipe(
        "disk",
        "Check the headroom",
        "Disk & storage",
        "Show mounted filesystem capacity in human-readable units.",
        "Show disk space",
        "df -h",
    ),
    recipe(
        "usage",
        "Measure a directory",
        "Disk & storage",
        "Summarize disk usage, recursively reading directory metadata.",
        "Show disk usage of the current directory",
        "du -sh -- .",
        [param("path", "Directory", ".")],
    ),
    recipe(
        "lines",
        "Read the opening lines",
        "Text processing",
        "Print a bounded number of lines from the beginning of a literal file.",
        'Show the first 20 lines of "README.md"',
        "head -n 20 -- README.md",
        [param("path", "File", "README.md"), param("count", "Lines (1–10000)", "20")],
    ),
    recipe(
        "search-text",
        "Find a literal phrase",
        "Text processing",
        "Search one file using literal, case-sensitive text; show line numbers.",
        'Search for "error" in "app.log"',
        "grep -n -F -- error app.log",
        [param("path", "File", "app.log"), param("pattern", "Literal text", "error")],
    ),
    recipe(
        "processes",
        "Take a process snapshot",
        "Processes",
        "List all visible processes. Output format varies by platform.",
        "List running processes",
        "ps aux",
    ),
    recipe(
        "identity",
        "Know your identity",
        "Permissions",
        "Display the current user and group identifiers, without changing permissions.",
        "Show my user and group IDs",
        "id",
    ),
]
BY_ID = {r.id: r for r in RECIPES}


def render(
    recipe_id: str, parameters: dict[str, str], profile: Profile
) -> TemplateResult:
    r = BY_ID.get(recipe_id)
    if not r:
        raise ValueError("Unknown recipe")
    if profile not in r.profiles:
        raise ValueError(
            "This recipe requires GNU/Linux with GNU findutils; choose that profile"
        )
    allowed = {p.name for p in r.parameters}
    if set(parameters) - allowed:
        raise ValueError("Unsupported recipe parameter")
    values = {p.name: parameters.get(p.name, p.default) for p in r.parameters}
    target = values.get("path", "current environment")
    p = path(target) if "path" in values else ""
    if recipe_id in {
        "large-files",
        "exact-bytes",
        "named-files",
        "directories",
    } and not target.startswith(("/", ".")):
        # Quoting does not stop find interpreting a leading ! or ( as an expression.
        p = path("./" + target)
    conditions = []
    threshold = None
    units = None
    scope = "Single utility invocation"
    if recipe_id in {"large-files", "exact-bytes"}:
        threshold = number(values["size"])
        units = "MiB" if recipe_id == "large-files" else "bytes"
        size = f"+{threshold}M" if recipe_id == "large-files" else f"{threshold}c"
        command = f"find {p} -type f -size {size}"
        conditions = [
            f"Regular files; {'strictly greater than' if recipe_id == 'large-files' else 'exactly'} {threshold} {units}"
        ]
        scope = (
            "Recursive; hidden entries included; symbolic links not followed by default"
        )
    elif recipe_id == "named-files":
        command = f"find {p} -type f -name {literal(values['pattern'])}"
        conditions = [f"Case-sensitive filename pattern: {values['pattern']}"]
        scope = (
            "Recursive; hidden entries included; symbolic links not followed by default"
        )
    elif recipe_id == "directories":
        command = f"find {p} -type d"
        conditions = ["Directories only"]
        scope = "Recursive; includes starting directory"
    elif recipe_id in {"list", "usage"}:
        command = f"{'ls -la' if recipe_id == 'list' else 'du -sh'} -- {p}"
        scope = (
            "Non-recursive listing"
            if recipe_id == "list"
            else "Recursive disk usage summary"
        )
    elif recipe_id == "lines":
        threshold = number(values["count"], 10000)
        command = f"head -n {threshold} -- {p}"
        conditions = [f"First {threshold} lines"]
    elif recipe_id == "search-text":
        command = f"grep -n -F -- {literal(values['pattern'])} {p}"
        conditions = [f"Literal case-sensitive text: {values['pattern']}"]
    else:
        command = r.command
    return TemplateResult(
        command,
        Intent(
            operation=r.title,
            target=target,
            conditions=conditions,
            threshold=threshold,
            units=units,
            platform=profile,
            scope=scope,
        ),
        [
            r.compatibility,
            "Paths refer to your environment, not the server. Nothing was inspected.",
            "Read operations may reveal sensitive data or take time on large trees.",
        ],
    )


# These full matches deliberately do not consume arbitrary trailing constraints.
SCOPE = r'(?:the current directory|"([^"\n]+)")'


def from_language(request: str, profile: Profile) -> TemplateResult | None:
    s = request.strip().removesuffix(".").strip()
    simple = {
        r"(?:show|print) (?:the |my )?current working directory": "pwd",
        r"(?:show|check) disk space": "disk",
        r"(?:list|show) running processes": "processes",
        r"show my user and group ids": "identity",
    }
    for grammar, id in simple.items():
        if re.fullmatch(grammar, s, re.I):
            return render(id, {}, profile)
    rules = [
        (
            rf"find files (?:larger than|greater than) ([1-9][0-9]*) (MiB|MB|bytes) in {SCOPE}",
            "large-files",
        ),
        (rf"find files exactly ([1-9][0-9]*) bytes in {SCOPE}", "exact-bytes"),
        (rf'find files named "([^"\n]+)" in {SCOPE}', "named-files"),
        (rf"find directories in {SCOPE}", "directories"),
        (rf"list all files in {SCOPE}", "list"),
        (rf"show disk usage of {SCOPE}", "usage"),
        (r'show the first ([1-9][0-9]*) lines of "([^"\n]+)"', "lines"),
        (r'search for "([^"\n]+)" in "([^"\n]+)"', "search-text"),
    ]
    for grammar, id in rules:
        m = re.fullmatch(grammar, s, re.I)
        if not m:
            continue
        groups = m.groups()
        if id == "large-files":
            if groups[1].lower() != "mib":
                raise ValueError(
                    "Please use MiB (1,048,576 bytes) for the larger-than recipe. MB and bytes are not interchangeable."
                )
            values = {"size": groups[0], "path": groups[2] or "."}
        elif id == "exact-bytes":
            values = {"size": groups[0], "path": groups[1] or "."}
        elif id == "named-files":
            values = {"pattern": groups[0], "path": groups[1] or "."}
        elif id in {"directories", "list", "usage"}:
            values = {"path": groups[0] or "."}
        elif id == "lines":
            values = {"count": groups[0], "path": groups[1]}
        else:
            values = {"pattern": groups[0], "path": groups[1]}
        return render(id, values, profile)
    return None
