"""AST-positioned token explanations. Unknown syntax is explicitly unverified."""

import re

from src.safety_validator import parse_nodes

from .schemas import Token

UTILITIES = {
    "find": "Walk a directory tree and evaluate tests for each entry.",
    "pwd": "Print the current working directory.",
    "ls": "List directory entries.",
    "df": "Report space on mounted filesystems.",
    "du": "Estimate disk usage by walking paths.",
    "head": "Read the beginning of a file.",
    "grep": "Select lines matching a pattern.",
    "ps": "Report a snapshot of processes.",
    "id": "Print user and group identifiers.",
    "rm": "Remove filesystem entries. Deleted data may be unrecoverable.",
    "cat": "Write file contents to standard output.",
}
FLAGS = {
    ("find", "-type"): (
        "File-type predicate",
        "Restrict results to the next file-type argument.",
    ),
    ("find", "-size"): (
        "Size predicate",
        "Compare rounded size units; c means bytes and M means 1,048,576-byte units in GNU find.",
    ),
    ("find", "-name"): (
        "Filename predicate",
        "Match the next shell-quoted pattern against basenames, case-sensitively.",
    ),
    ("find", "-delete"): (
        "Deletion action",
        "Deletes matching entries. Review traversal and predicate order carefully.",
    ),
    ("ls", "-la"): (
        "Listing options",
        "Long format and all entries, including hidden names and . / ..; no recursion.",
    ),
    ("df", "-h"): (
        "Human-readable units",
        "Scale capacity units for display; exact presentation varies by utility.",
    ),
    ("du", "-sh"): (
        "Summary and units",
        "Summarize recursive usage and use human-readable display units.",
    ),
    ("head", "-n"): (
        "Line count option",
        "Use the next positive integer as the maximum number of lines.",
    ),
    ("grep", "-n"): ("Line numbers", "Prefix each matching line with its line number."),
    ("grep", "-F"): (
        "Literal matching",
        "Treat the pattern as fixed text rather than a regular expression.",
    ),
    ("ps", "aux"): (
        "Process selection",
        "Show processes for all users in a user-oriented format; output varies by OS.",
    ),
}


def explain_tokens(command: str) -> list[Token]:
    try:
        nodes = parse_nodes(command)
    except Exception:
        return []
    result = {}
    for n in nodes:
        if n.kind != "command":
            continue
        words = [part for part in n.parts if part.kind == "word"]
        if not words:
            continue
        utility = words[0].word
        for index, part in enumerate(words):
            start, end = part.pos
            text = command[start:end]
            word = part.word
            prev = words[index - 1].word if index else ""
            role, explanation = (
                "Argument",
                "No curated explanation is available for this argument.",
            )
            implication = "Interpret this in the full command and your environment; static checks are incomplete."
            supported, constraint = False, None
            if getattr(part, "parts", []):
                role = "Dynamic shell expression"
                explanation = "Contains an expansion or substitution; its runtime value is not known."
            elif index == 0 and utility in UTILITIES:
                role, explanation, supported = "Utility", UTILITIES[utility], True
                implication = "This names the utility. Options, environment and operands determine its behavior."
            elif (utility, word) in FLAGS:
                role, explanation = FLAGS[(utility, word)]
                supported = True
                implication = (
                    "Changes how this utility evaluates or displays its inputs."
                )
            elif word == "--" and utility in {"ls", "du", "head", "grep"}:
                role, explanation, supported = (
                    "Option boundary",
                    "End option parsing; following values are operands.",
                    True,
                )
                implication = (
                    "A following value starting with a dash is interpreted as data."
                )
            elif utility == "find" and prev == "-type" and word in {"f", "d"}:
                role = "File type"
                explanation = (
                    "Match regular files only."
                    if word == "f"
                    else "Match directories only."
                )
                supported, constraint = True, explanation
            elif (
                utility == "find"
                and prev == "-size"
                and re.fullmatch(r"[+-]?\d+[cMk]?", word)
            ):
                role, supported = "Size constraint", True
                sign = (
                    "Greater than"
                    if word.startswith("+")
                    else "Less than"
                    if word.startswith("-")
                    else "Equal to"
                )
                explanation = f"{sign} {word.lstrip('+-')}, in the rounded units selected by the suffix."
                implication = "GNU find rounds size upward in units: M = MiB. +100M means more than 100 MiB; 100M means >99 MiB and ≤100 MiB. c compares exact bytes. Other find implementations may differ."
                constraint = "File size comparison"
            elif utility == "find" and prev == "-name":
                role, explanation, supported = (
                    "Filename pattern",
                    "A literal pattern passed to find; find performs the matching.",
                    True,
                )
                implication = "Quote wildcards to prevent your shell expanding them before find runs."
            elif utility == "find" and index == 1 and not word.startswith("-"):
                role, explanation, supported = (
                    "Starting path",
                    f"Begin traversal at {word}.",
                    True,
                )
                implication = "Traversal is recursive. No such directory has been inspected by ShellForge."
            elif utility == "head" and prev == "-n" and word.isdigit():
                role, explanation, supported = (
                    "Line limit",
                    f"Read at most {word} lines.",
                    True,
                )
            result[(start, end)] = Token(
                text=text,
                start=start,
                end=end,
                role=role,
                explanation=explanation,
                implication=implication,
                constraint=constraint,
                supported=supported,
            )
    return [result[key] for key in sorted(result)]
