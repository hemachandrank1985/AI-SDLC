const fs = require('fs');
const crypto = require('crypto');

function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function main() {
  const logPath = process.argv[2] || './sample-data/evidence_log.json';
  const decisionPath = process.argv[3] || './sample-data/opa_decision.json';
  const runId = process.env.GITHUB_RUN_ID || `local-run-${Date.now()}`;
  
  let evidenceLog = [];
  if (fs.existsSync(logPath)) {
    evidenceLog = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } else {
    // Genesis block
    evidenceLog.push({
      run_id: "genesis",
      timestamp: new Date().toISOString(),
      hash: generateHash("genesis"),
      previous_hash: "0".repeat(64),
      decision: "ALLOW",
      risk_score: 0
    });
  }

  const lastEntry = evidenceLog[evidenceLog.length - 1];
  const previousHash = lastEntry.hash;
  
  let decisionData = { decision: "UNKNOWN", risk_score: 0 };
  if (fs.existsSync(decisionPath)) {
    decisionData = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
  }

  const newEntryData = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    previous_hash: previousHash,
    decision: decisionData.decision || "DENY",
    risk_score: decisionData.risk_score || 0,
    violations_count: decisionData.violations ? decisionData.violations.length : 0
  };

  // Hash chaining: hash(previous_hash + current_data)
  const dataString = JSON.stringify(newEntryData);
  const newHash = generateHash(previousHash + dataString);
  
  const newEntry = {
    ...newEntryData,
    hash: newHash
  };

  evidenceLog.push(newEntry);
  fs.writeFileSync(logPath, JSON.stringify(evidenceLog, null, 2));
  console.log(`Appended to evidence log. New hash: ${newHash}`);
}

main();
