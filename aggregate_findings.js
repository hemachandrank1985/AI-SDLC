const fs = require('fs');
const path = require('path');

function parseCodeQL(sarifPath) {
  const findings = [];
  try {
    if (fs.existsSync(sarifPath)) {
      const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));
      const runs = sarif.runs || [];
      runs.forEach(run => {
        const results = run.results || [];
        results.forEach(res => {
          findings.push({
            id: res.ruleId || 'unknown',
            severity: res.level === 'error' ? 'HIGH' : res.level === 'warning' ? 'MEDIUM' : 'LOW',
            message: res.message ? res.message.text : 'No message',
            file: res.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown',
            line: res.locations?.[0]?.physicalLocation?.region?.startLine || 0
          });
        });
      });
    }
  } catch (e) {
    console.error("Error parsing CodeQL SARIF:", e.message);
  }
  return findings;
}

function parseNpmAudit(auditPath) {
  const findings = [];
  try {
    if (fs.existsSync(auditPath)) {
      const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      const vulnerabilities = audit.vulnerabilities || {};
      Object.keys(vulnerabilities).forEach(pkg => {
        const vuln = vulnerabilities[pkg];
        findings.push({
          id: `npm:${pkg}`,
          severity: vuln.severity.toUpperCase(),
          message: vuln.name + ' vulnerability',
          package: pkg,
          version: vuln.range || 'unknown'
        });
      });
    }
  } catch (e) {
    console.error("Error parsing npm audit:", e.message);
  }
  return findings;
}

function parseZap(zapPath) {
  const findings = [];
  try {
    if (fs.existsSync(zapPath)) {
      const zap = JSON.parse(fs.readFileSync(zapPath, 'utf8'));
      const sites = zap.site || [];
      sites.forEach(site => {
        const alerts = site.alerts || [];
        alerts.forEach(alert => {
          let severity = 'INFO';
          if (alert.riskcode === '3') severity = 'HIGH';
          else if (alert.riskcode === '2') severity = 'MEDIUM';
          else if (alert.riskcode === '1') severity = 'LOW';
          
          findings.push({
            id: `zap:${alert.pluginid}`,
            severity: severity,
            message: alert.alert,
            url: alert.instances?.[0]?.uri || 'unknown',
            method: alert.instances?.[0]?.method || 'GET'
          });
        });
      });
    }
  } catch (e) {
    console.error("Error parsing ZAP results:", e.message);
  }
  return findings;
}

function main() {
  const codeqlPath = process.argv[2] || 'codeql-results.sarif';
  const scaPath = process.argv[3] || 'public/sample-data/sca-results.json';
  const zapPath = process.argv[4] || 'report_json.json';
  const outPath = process.argv[5] || 'public/sample-data/findings.json';

  // Ensure output directory exists
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const sast = parseCodeQL(codeqlPath);
  const sca = parseNpmAudit(scaPath);
  const dast = parseZap(zapPath);

  const findings = { sast, sca, dast };

  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`Aggregated findings written to ${outPath}`);
  console.log(`- SAST: ${sast.length}`);
  console.log(`- SCA: ${sca.length}`);
  console.log(`- DAST: ${dast.length}`);
}

main();
