#!/usr/bin/env node
/**
 * compute_metrics.js
 * ==================
 * Post-processing script for AG-SDLC experiment evaluation.
 *
 * Given:
 *   - A set of downloaded GitHub Actions artifacts (tool reports + timing manifests)
 *   - The ground-truth catalogue (juice_shop_ground_truth.json)
 *
 * Produces for each (config, run_id):
 *   TP, FP, FN, Recall, Precision, FPR, MTTD (min), Pipeline runtime (min)
 *
 * Usage:
 *   node compute_metrics.js \
 *     --ground-truth  experiment/juice_shop_ground_truth.json \
 *     --artifacts-dir ./artifacts \
 *     --config        AG-SDLC \
 *     --run-id        run-01 \
 *     --out           experiment/run_results.jsonl
 *
 * Artifact directory layout expected:
 *   artifacts/
 *     codeql-sarif-<CONFIG>-<RUN_ID>/          (*.sarif)
 *     sca-report-<CONFIG>-<RUN_ID>/            (sca-report.json)
 *     zap-report-<CONFIG>-<RUN_ID>/            (zap-report.json)
 *     sast-timing-<CONFIG>-<RUN_ID>/           (sast-timing.json)
 *     sca-timing-<CONFIG>-<RUN_ID>/            (sca-timing.json)
 *     dast-timing-<CONFIG>-<RUN_ID>/           (dast-timing.json)
 *     run-manifest-<CONFIG>-<RUN_ID>/          (run-manifest.json)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ─── CLI Argument Parsing ───────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, '')] = args[i + 1];
  }
  const required = ['ground-truth', 'artifacts-dir', 'config', 'run-id', 'out'];
  for (const r of required) {
    if (!opts[r]) {
      console.error(`Missing required argument: --${r}`);
      process.exit(1);
    }
  }
  return opts;
}

// ─── File helpers ────────────────────────────────────────────────────────────
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.warn(`Could not parse ${filePath}: ${e.message}`); return null; }
}

function findFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.match(pattern));
  return match ? path.join(dir, match) : null;
}

// ─── Tool-report parsers ─────────────────────────────────────────────────────

/**
 * Extract finding identifiers from a CodeQL SARIF file.
 * Returns array of { ruleId, file, startLine }
 */
function parseCodeQLSarif(sarifPath) {
  const sarif = readJson(sarifPath);
  if (!sarif) return [];
  const findings = [];
  for (const run of (sarif.runs || [])) {
    for (const result of (run.results || [])) {
      findings.push({
        ruleId:    result.ruleId || '',
        file:      result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || '',
        startLine: result.locations?.[0]?.physicalLocation?.region?.startLine || 0,
      });
    }
  }
  return findings;
}

/**
 * Extract vulnerability identifiers from npm audit JSON.
 * Returns array of { cve, advisory, package }
 */
function parseNpmAudit(auditPath) {
  const audit = readJson(auditPath);
  if (!audit) return [];
  const findings = [];
  const vulns = audit.vulnerabilities || {};
  for (const [pkgName, data] of Object.entries(vulns)) {
    const viaList = Array.isArray(data.via) ? data.via : [data.via];
    for (const via of viaList) {
      if (typeof via === 'object' && via !== null) {
        findings.push({
          cve:      via.cve || '',
          advisory: String(via.url || '').split('/').pop() || '',
          package:  pkgName,
          severity: via.severity || data.severity || 'unknown',
        });
      }
    }
  }
  return findings;
}

/**
 * Extract findings from ZAP JSON report.
 * Returns array of { pluginId, alertName, url }
 */
function parseZapReport(zapPath) {
  const zap = readJson(zapPath);
  if (!zap) return [];
  const findings = [];
  const alerts = zap.site?.[0]?.alerts || zap.alerts || [];
  for (const alert of alerts) {
    findings.push({
      pluginId:  String(alert.pluginid || alert.pluginId || ''),
      alertName: (alert.alert || alert.name || '').toLowerCase(),
      riskCode:  alert.riskcode || alert.riskCode || '0',
    });
  }
  return findings;
}

// ─── Ground-truth matching ────────────────────────────────────────────────────

/**
 * Returns true if a CodeQL finding matches a ground-truth entry.
 */
function matchSast(finding, gt) {
  if (!gt.codeql_rule_ids) return false;
  return gt.codeql_rule_ids.some(rid => finding.ruleId.startsWith(rid));
}

/**
 * Returns true if an npm-audit finding matches a ground-truth entry.
 */
function matchSca(finding, gt) {
  if (!gt.cve_ids && !gt.npm_advisory_ids) return false;
  const cveMatch = (gt.cve_ids || []).some(
    cve => finding.cve && finding.cve.toLowerCase() === cve.toLowerCase()
  );
  const advMatch = (gt.npm_advisory_ids || []).some(
    aid => finding.advisory && finding.advisory === String(aid)
  );
  const pkgMatch = gt.package && finding.package === gt.package;
  return cveMatch || advMatch || pkgMatch;
}

/**
 * Returns true if a ZAP finding matches a ground-truth entry.
 */
function matchDast(finding, gt) {
  if (!gt.zap_plugin_ids && !gt.zap_alert_name) return false;
  const pidMatch = (gt.zap_plugin_ids || []).includes(finding.pluginId);
  const nameMatch = gt.zap_alert_name &&
    finding.alertName.includes(gt.zap_alert_name.toLowerCase());
  return pidMatch || nameMatch;
}

/**
 * For a given config and set of tool findings, classify each GT entry as TP or FN.
 * Also identify FP findings (those that don't match any GT entry).
 */
function classifyFindings(config, gtEntries, sastFindings, scaFindings, dastFindings) {
  const configKey = config.replace(/-/g, '_'); // AG-SDLC -> AG_SDLC

  let TP = 0, FN = 0;
  const matchedSast = new Set();
  const matchedSca  = new Set();
  const matchedDast = new Set();

  for (const gt of gtEntries) {
    const isDetectable = gt.detectable_by[configKey];
    if (!isDetectable) {
      // Cannot be detected by this config at all - counts as FN only if it was
      // theoretically possible; here we count it as FN to reflect missed coverage.
      FN++;
      continue;
    }

    let detected = false;
    if (gt.source_layer === 'SAST') {
      const idx = sastFindings.findIndex(f => matchSast(f, gt));
      if (idx !== -1) { detected = true; matchedSast.add(idx); }
    } else if (gt.source_layer === 'SCA') {
      const idx = scaFindings.findIndex(f => matchSca(f, gt));
      if (idx !== -1) { detected = true; matchedSca.add(idx); }
    } else if (gt.source_layer === 'DAST') {
      const idx = dastFindings.findIndex(f => matchDast(f, gt));
      if (idx !== -1) { detected = true; matchedDast.add(idx); }
    }
    if (detected) TP++; else FN++;
  }

  // FP = findings reported by tools that did NOT match any GT entry
  const fpSast = sastFindings.filter((_, i) => !matchedSast.has(i)).length;
  const fpSca  = scaFindings.filter((_, i)  => !matchedSca.has(i)).length;
  const fpDast = dastFindings.filter((_, i) => !matchedDast.has(i)).length;
  const FP     = fpSast + fpSca + fpDast;

  return { TP, FP, FN };
}

// ─── Timing helpers ───────────────────────────────────────────────────────────

function isoToMs(isoStr) {
  return isoStr ? new Date(isoStr).getTime() : null;
}

function msToMin(ms) {
  return ms != null ? +(ms / 60000).toFixed(2) : null;
}

/**
 * MTTD = earliest detection timestamp across all tool steps - commit/pipeline start.
 * We use the step *end* timestamp as proxy for "first finding available".
 */
function computeMTTD(manifest, timings) {
  const commitTs = isoToMs(manifest.commit_ts);
  if (!commitTs) return null;

  const detectionTimes = timings
    .map(t => isoToMs(t.end))
    .filter(Boolean);

  if (detectionTimes.length === 0) return null;
  const firstDetection = Math.min(...detectionTimes);
  return msToMin(firstDetection - commitTs);
}

/**
 * Pipeline runtime = pipeline end - commit start.
 */
function computeRuntime(manifest) {
  const start = isoToMs(manifest.commit_ts);
  const end   = isoToMs(manifest.pipeline_end_ts);
  if (!start || !end) return null;
  return msToMin(end - start);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs();
  const config     = opts['config'];       // e.g. 'AG-SDLC'
  const runId      = opts['run-id'];       // e.g. 'run-01'
  const artDir     = opts['artifacts-dir'];
  const gtPath     = opts['ground-truth'];
  const outPath    = opts['out'];

  console.log(`\n=== compute_metrics.js  config=${config}  run_id=${runId} ===`);

  // 1. Load ground truth
  const gt = readJson(gtPath);
  if (!gt) { console.error('Cannot load ground truth'); process.exit(1); }
  const gtEntries = gt.vulnerabilities;

  // 2. Load tool reports
  const sarifDir = path.join(artDir, `codeql-sarif-${config}-${runId}`);
  const sarifFile = findFile(sarifDir, /\.sarif$/) || '';
  const scaFile   = findFile(path.join(artDir, `sca-report-${config}-${runId}`), /\.json$/) || '';
  const zapFile   = findFile(path.join(artDir, `zap-report-${config}-${runId}`),  /\.json$/) || '';

  const sastFindings = sarifFile ? parseCodeQLSarif(sarifFile) : [];
  const scaFindings  = scaFile   ? parseNpmAudit(scaFile)      : [];
  const dastFindings = zapFile   ? parseZapReport(zapFile)     : [];

  console.log(`  SAST findings: ${sastFindings.length}`);
  console.log(`  SCA  findings: ${scaFindings.length}`);
  console.log(`  DAST findings: ${dastFindings.length}`);

  // 3. TP / FP / FN
  const { TP, FP, FN } = classifyFindings(
    config, gtEntries, sastFindings, scaFindings, dastFindings
  );

  const recall    = TP + FN > 0 ? +(TP / (TP + FN)).toFixed(4)          : null;
  const precision = TP + FP > 0 ? +(TP / (TP + FP)).toFixed(4)          : null;
  const fpr       = TP + FP > 0 ? +(FP / (TP + FP)).toFixed(4)          : null;

  console.log(`  TP=${TP}  FP=${FP}  FN=${FN}`);
  console.log(`  Recall=${recall}  Precision=${precision}  FPR=${fpr}`);

  // 4. Load timing manifests
  function loadTiming(step) {
    const dir  = path.join(artDir, `${step}-timing-${config}-${runId}`);
    const file = findFile(dir, /\.json$/);
    return file ? readJson(file) : null;
  }

  const timings = ['sast', 'sca', 'dast']
    .map(loadTiming)
    .filter(Boolean);

  const manifestDir  = path.join(artDir, `run-manifest-${config}-${runId}`);
  const manifestFile = findFile(manifestDir, /\.json$/);
  const manifest     = manifestFile ? readJson(manifestFile) : {};

  const mttd    = computeMTTD(manifest, timings);
  const runtime = computeRuntime(manifest);

  console.log(`  MTTD=${mttd} min  Runtime=${runtime} min`);

  // 5. Build result record
  const result = {
    config,
    run_id:    runId,
    timestamp: new Date().toISOString(),
    detection: { TP, FP, FN },
    metrics: {
      recall,
      precision,
      fpr,
      mttd_min:    mttd,
      runtime_min: runtime,
    },
    raw_counts: {
      sast_total: sastFindings.length,
      sca_total:  scaFindings.length,
      dast_total: dastFindings.length,
    },
    manifest,
  };

  // 6. Append to output JSONL (one record per line)
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(result) + '\n', 'utf8');
  console.log(`  Result appended to ${outPath}\n`);
}

main();
