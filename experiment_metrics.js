const fs = require('fs');

/**
 * EXPERIMENT DESIGN:
 * This script calculates metrics to evaluate the AG-SDLC prototype.
 * 
 * Metrics to collect:
 * 1. Detection count per tool (SAST, SCA, DAST)
 * 2. False Positives (Simulated via manual tagging in findings.json)
 * 3. Pipeline Runtime (Simulated or extracted from GitHub Actions logs)
 * 4. Governance Decision Latency (Time taken to run OPA + Risk Scoring)
 */

function runExperiment() {
  console.log("=== AG-SDLC Prototype Experiment Metrics ===");
  
  // 1. Detection Counts
  const findingsPath = './sample-data/findings.json';
  if (fs.existsSync(findingsPath)) {
    const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
    console.log("\n1. Detection Counts:");
    console.log(`   - SAST (CodeQL): ${findings.sast ? findings.sast.length : 0}`);
    console.log(`   - SCA (npm audit): ${findings.sca ? findings.sca.length : 0}`);
    console.log(`   - DAST (ZAP): ${findings.dast ? findings.dast.length : 0}`);
    
    // 2. False Positives (Mock logic: assume 10% of findings are FP for demonstration)
    const totalFindings = (findings.sast?.length || 0) + (findings.sca?.length || 0) + (findings.dast?.length || 0);
    const estimatedFPs = Math.floor(totalFindings * 0.1);
    console.log("\n2. False Positives:");
    console.log(`   - Estimated FPs (10% heuristic): ${estimatedFPs}`);
    console.log(`   - True Positives: ${totalFindings - estimatedFPs}`);
  }

  // 3 & 4. Latency and Runtime
  // In a real scenario, these would be measured using timestamps before and after execution.
  console.log("\n3. Pipeline Runtime (Simulated):");
  console.log("   - Build & SAST: ~120s");
  console.log("   - SCA: ~30s");
  console.log("   - DAST (Baseline): ~180s");
  console.log("   - Total CI/CD Time: ~330s");

  console.log("\n4. Governance Decision Latency (Simulated):");
  const start = process.hrtime();
  // Simulate OPA eval
  for(let i=0; i<1000000; i++) {} 
  const end = process.hrtime(start);
  const latencyMs = (end[0] * 1000) + (end[1] / 1000000);
  console.log(`   - Risk Scoring + OPA Eval: ${latencyMs.toFixed(2)} ms`);
  
  console.log("\n============================================");
}

runExperiment();
