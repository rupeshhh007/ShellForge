"""Descriptive command metrics. AST similarity never establishes semantics."""
from collections import Counter, defaultdict
import math
import re


def wilson(successes, n):
    if not n:
        raise ValueError('Empty sample')
    z = 1.959963984540054
    p = successes / n
    denominator = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denominator
    radius = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
    return [max(0, centre - radius), min(1, centre + radius)]


def ast_fingerprint(command):
    """Preserve literal source, quoting, arguments and order; remove positional trivia."""
    import bashlex
    def encode(node):
        if node.kind == 'word':
            return (node.kind, command[node.pos[0]:node.pos[1]])
        values = []
        for key, value in sorted(vars(node).items()):
            if key in {'pos', 'kind'}:
                continue
            if hasattr(value, 'kind'):
                value = encode(value)
            elif isinstance(value, list):
                value = tuple(encode(v) if hasattr(v, 'kind') else str(v) for v in value)
            else:
                value = str(value)
            values.append((key, value))
        return (node.kind, tuple(values))
    try:
        return tuple(encode(n) for n in bashlex.parse(command)) or None
    except Exception:  # Parser rejects unsupported/malformed generated text; score unsupported.
        return None


def normalized_command(command):
    # AST-based trivia normalization preserves quote/expansion distinctions and operands.
    return ast_fingerprint(command)


def node_kinds(command):
    from .safety_validator import parse_nodes
    try:
        return Counter(n.kind for n in parse_nodes(command))
    except Exception:  # Parser rejects unsupported/malformed generated text; score unsupported.
        return None


def compare_command(prediction, reference):
    pred, ref = ast_fingerprint(prediction), ast_fingerprint(reference)
    a, b = node_kinds(prediction), node_kinds(reference)
    similarity = (2 * sum((a & b).values()) / (sum(a.values()) + sum(b.values()))
                  if a and b else None)
    return {'normalized_match': pred is not None and ref is not None and pred == ref,
            'ast_parse_supported': a is not None and b is not None,
            'ast_node_kind_dice': similarity,
            'failure_category': ('exact_match' if prediction == reference else
                                 'formatting' if '```' in prediction or re.search(r'(?i)^(here|this command)', prediction) else
                                 'text_mismatch_requires_semantic_review')}


def summarize(examples):
    n = len(examples)
    if not n:
        raise ValueError('Empty evaluation set')
    groups = defaultdict(list)
    for item in examples:
        groups[item.get('category', 'unclassified')].append(item)
    supported = [e['ast_node_kind_dice'] for e in examples if e.get('ast_node_kind_dice') is not None]
    return {'bash_syntax_validity': sum(e.get('syntax_valid', False) for e in examples) / n,
            'exact_match_count': sum(e['exact_match'] for e in examples),
            'exact_match_wilson_95': wilson(sum(e['exact_match'] for e in examples), n),
            'normalized_match': sum(e['normalized_match'] for e in examples) / n,
            'ast_supported_pairs': len(supported),
            'ast_node_kind_dice_mean': sum(supported) / len(supported) if supported else None,
            'per_category': {k: {'n': len(rows), 'exact_match': sum(e['exact_match'] for e in rows) / len(rows),
                                'wilson_95': wilson(sum(e['exact_match'] for e in rows), len(rows))}
                             for k, rows in sorted(groups.items())},
            'formatting_violation_count': sum(e.get('formatting_violation', False) for e in examples),
            'generation_truncated_count': sum(e.get('generation_truncated', False) for e in examples),
            'failure_categories': dict(Counter(e['failure_category'] for e in examples)),
            'uncertainty_limit': 'Wilson intervals assume independent cases; grouped corpus dependencies can widen uncertainty.',
            'structural_metric_limit': 'AST trivia match and node-kind overlap are descriptive only, not semantic equivalence.'}


def paired_comparison(base, tuned):
    if len(base) != len(tuned) or not base:
        raise ValueError('Paired evaluation requires identical nonempty samples')
    for a, b in zip(base, tuned):
        if (a.get('id'), a['instruction'], a['reference']) != (b.get('id'), b['instruction'], b['reference']):
            raise ValueError('Paired evaluation examples/order differ')
    gains = sum(not a['exact_match'] and b['exact_match'] for a, b in zip(base, tuned))
    losses = sum(a['exact_match'] and not b['exact_match'] for a, b in zip(base, tuned))
    discordant = gains + losses
    # Exact two-sided McNemar binomial test; paired successes are not independent proportions.
    p = min(1.0, 2 * sum(math.comb(discordant, k) for k in range(min(gains, losses) + 1)) / 2 ** discordant) if discordant else 1.0
    return {'n': len(base), 'tuned_only_correct': gains, 'base_only_correct': losses,
            'exact_match_delta': (gains - losses) / len(base), 'mcnemar_exact_p': p,
            'limitations': 'Pairs can be correlated within corpus groups; this is not a semantic accuracy test.'}
