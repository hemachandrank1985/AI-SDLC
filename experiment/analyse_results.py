#!/usr/bin/env python3
"""
analyse_results.py
==================
Aggregates per-run JSONL output from compute_metrics.js into the
summary comparison table (B1 vs B2 vs AG-SDLC) needed for the paper.

Inputs
------
experiment/run_results.jsonl   -- one JSON record per line, each produced
                                  by compute_metrics.js

Outputs
-------
* Prints a Markdown / LaTeX-ready table to stdout
* Writes experiment/summary_table.csv

Usage
-----
    python experiment/analyse_results.py \\
        --results experiment/run_results.jsonl \\
        --out     experiment/summary_table.csv \\
        --latex

Dependencies: numpy, scipy, tabulate  (pip install numpy scipy tabulate)
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from collections import defaultdict

import numpy as np
from scipy import stats
from tabulate import tabulate


# ─── helpers ──────────────────────────────────────────────────────────────────

def ci95(values):
    """Return (mean, lower_95, upper_95) for a list of floats."""
    arr = [v for v in values if v is not None]
    if len(arr) == 0:
        return None, None, None
    if len(arr) == 1:
        return arr[0], arr[0], arr[0]
    m = np.mean(arr)
    se = stats.sem(arr)
    lo, hi = stats.t.interval(0.95, df=len(arr) - 1, loc=m, scale=se)
    return round(float(m), 4), round(float(lo), 4), round(float(hi), 4)


def fmt(mean, lo, hi, decimals=3):
    """Format mean (95 % CI) for display."""
    if mean is None:
        return 'N/A'
    return f'{mean:.{decimals}f} [{lo:.{decimals}f},{hi:.{decimals}f}]'


def fmt_min(mean, lo, hi):
    """Format minutes with 1 decimal."""
    if mean is None:
        return 'N/A'
    return f'{mean:.1f} [{lo:.1f},{hi:.1f}]'


# ─── load data ────────────────────────────────────────────────────────────────

def load_results(path: Path):
    """Load all records from the JSONL file."""
    records = []
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


# ─── aggregate ────────────────────────────────────────────────────────────────

def aggregate(records):
    """
    Group records by config, then compute mean + 95% CI for each metric.
    Returns dict: config -> summary dict.
    """
    buckets = defaultdict(list)
    for r in records:
        buckets[r['config']].append(r)

    summary = {}
    for cfg, recs in sorted(buckets.items()):
        m = lambda key: [r['metrics'].get(key) for r in recs]

        recall_m,    recall_lo,    recall_hi    = ci95(m('recall'))
        precision_m, precision_lo, precision_hi = ci95(m('precision'))
        fpr_m,       fpr_lo,       fpr_hi       = ci95(m('fpr'))
        mttd_m,      mttd_lo,      mttd_hi      = ci95(m('mttd_min'))
        rt_m,        rt_lo,        rt_hi         = ci95(m('runtime_min'))

        # raw mean TP/FP/FN for reference
        tps = [r['detection']['TP'] for r in recs]
        fps = [r['detection']['FP'] for r in recs]
        fns = [r['detection']['FN'] for r in recs]

        summary[cfg] = {
            'n_runs':    len(recs),
            'mean_TP':   round(np.mean(tps), 1),
            'mean_FP':   round(np.mean(fps), 1),
            'mean_FN':   round(np.mean(fns), 1),
            'recall':    (recall_m,    recall_lo,    recall_hi),
            'precision': (precision_m, precision_lo, precision_hi),
            'fpr':       (fpr_m,       fpr_lo,       fpr_hi),
            'mttd_min':  (mttd_m,      mttd_lo,      mttd_hi),
            'runtime_min': (rt_m,      rt_lo,        rt_hi),
        }

    # Relative runtime (normalise to B1)
    b1_rt = summary.get('B1', {}).get('runtime_min', (None, None, None))[0]
    for cfg in summary:
        rt_m = summary[cfg]['runtime_min'][0]
        summary[cfg]['runtime_ratio'] = (
            round(rt_m / b1_rt, 3) if (rt_m is not None and b1_rt) else None
        )

    return summary


# ─── render ───────────────────────────────────────────────────────────────────

CONFIG_ORDER = ['B1', 'B2', 'AG-SDLC']


def build_table_rows(summary):
    rows = []
    for cfg in CONFIG_ORDER:
        if cfg not in summary:
            continue
        s = summary[cfg]
        rows.append([
            cfg,
            s['n_runs'],
            s['mean_TP'],
            s['mean_FP'],
            s['mean_FN'],
            fmt(*s['recall']),
            fmt(*s['precision']),
            fmt(*s['fpr']),
            fmt_min(*s['mttd_min']),
            fmt_min(*s['runtime_min']),
            s['runtime_ratio'] if s['runtime_ratio'] is not None else 'N/A',
        ])
    return rows


HEADERS = [
    'Config', 'Runs',
    'TP', 'FP', 'FN',
    'Recall (95% CI)',
    'Precision (95% CI)',
    'FPR (95% CI)',
    'MTTD min (95% CI)',
    'Runtime min (95% CI)',
    'Runtime ratio',
]


def print_table(rows, latex=False):
    if latex:
        print('\n% ---- LaTeX table (booktabs) ---')
        print('\\begin{table}[h]')
        print('\\centering')
        print('\\caption{AG-SDLC vs Baselines: Detection and Efficiency Metrics}')
        print('\\label{tab:results}')
        print('\\begin{tabular}{lrrrrllllll}')
        print('\\toprule')
        print(' & '.join(f'\\textbf{{{h}}}' for h in HEADERS) + ' \\\\')
        print('\\midrule')
        for row in rows:
            print(' & '.join(str(c) for c in row) + ' \\\\')
        print('\\bottomrule')
        print('\\end{tabular}')
        print('\\end{table}')
    else:
        print(tabulate(rows, headers=HEADERS, tablefmt='github'))


def write_csv(rows, out_path: Path):
    with open(out_path, 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADERS)
        writer.writerows(rows)
    print(f'\nCSV written to {out_path}')


# ─── per-metric statistical significance (Wilcoxon signed-rank B1 vs AG-SDLC)
def significance_tests(records):
    """
    For each key metric, run a Wilcoxon signed-rank test between B1 and AG-SDLC
    (paired by run number order). Prints p-values.
    """
    from collections import defaultdict
    by_cfg = defaultdict(list)
    for r in records:
        by_cfg[r['config']].append(r)

    if 'B1' not in by_cfg or 'AG-SDLC' not in by_cfg:
        print('\n[significance] Need both B1 and AG-SDLC runs for Wilcoxon test.')
        return

    keys = ['recall', 'precision', 'fpr', 'mttd_min', 'runtime_min']
    print('\n--- Wilcoxon signed-rank test: B1 vs AG-SDLC ---')
    for k in keys:
        a = [r['metrics'].get(k) for r in by_cfg['B1']      if r['metrics'].get(k) is not None]
        b = [r['metrics'].get(k) for r in by_cfg['AG-SDLC'] if r['metrics'].get(k) is not None]
        n = min(len(a), len(b))
        if n < 2:
            print(f'  {k:20s}: insufficient data (n={n})')
            continue
        try:
            stat, p = stats.wilcoxon(a[:n], b[:n])
            sig = '***' if p < 0.001 else ('**' if p < 0.01 else ('*' if p < 0.05 else 'ns'))
            print(f'  {k:20s}: W={stat:.1f}  p={p:.4f}  {sig}')
        except Exception as e:
            print(f'  {k:20s}: error - {e}')


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Aggregate AG-SDLC experiment results.')
    parser.add_argument('--results', default='experiment/run_results.jsonl',
                        help='Path to JSONL results file')
    parser.add_argument('--out',     default='experiment/summary_table.csv',
                        help='Output CSV path')
    parser.add_argument('--latex',   action='store_true',
                        help='Also print LaTeX table')
    args = parser.parse_args()

    results_path = Path(args.results)
    if not results_path.exists():
        print(f'ERROR: {results_path} not found.', file=sys.stderr)
        print('Run compute_metrics.js for each (config, run_id) first.', file=sys.stderr)
        sys.exit(1)

    records = load_results(results_path)
    print(f'Loaded {len(records)} run records from {results_path}')

    if not records:
        print('No records found. Exiting.')
        sys.exit(0)

    summary = aggregate(records)

    print('\n=== Summary Table (mean, 95% CI) ===\n')
    rows = build_table_rows(summary)
    print_table(rows, latex=False)

    if args.latex:
        print_table(rows, latex=True)

    write_csv(rows, Path(args.out))
    significance_tests(records)


if __name__ == '__main__':
    main()
