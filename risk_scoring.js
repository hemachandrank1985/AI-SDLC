const fs = require('fs');

// Weights for different tools
const WEIGHTS = {
  SAST: 0.3,
  SCA: 0.3,
  DAST: 0.4
};

// Severity multipliers
const SEVERITY_SCORE = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 4,
  LOW: 1,
  INFO: 0
};

function calculateToolScore(findings, toolWeight) {
  if (!findings || !Array.isArray(findings) || findings.length === 0) return 0;
  
  let score = 0;
  for (const finding of findings) {
    const sev = finding.severity ? finding.severity.toUpperCase() : 'INFO';
    score += (SEVERITY_SCORE[sev] || 0);
  }
  
  // Normalize somewhat (cap at 100 before weight)
  const normalizedScore = Math.min(score * 5, 100);
  return normalizedScore * toolWeight;
}

function main() {
  const findingsPath = process.argv[2] || './public/sample-data/findings.json';
  const outputPath = process.argv[3] || './public/sample-data/risk_score.json';
  
  let findings = { sast: [], sca: [], dast: [] };
  
  if (fs.existsSync(findingsPath)) {
    try {
      findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
    } catch (e) {
      console.error(`Error parsing findings JSON: ${e.message}`);
    }
  } else {
    console.warn(`Findings file not found at ${findingsPath}. Using empty findings.`);
  }
  
  const sastScore = calculateToolScore(findings.sast, WEIGHTS.SAST);
  const scaScore = calculateToolScore(findings.sca, WEIGHTS.SCA);
  const dastScore = calculateToolScore(findings.dast, WEIGHTS.DAST);
  
  const totalRiskScore = sastScore + scaScore + dastScore;
  
  const result = {
    risk_score: parseFloat(totalRiskScore.toFixed(2)),
    metrics: {
      sast_score: parseFloat(sastScore.toFixed(2)),
      sca_score: parseFloat(scaScore.toFixed(2)),
      dast_score: parseFloat(dastScore.toFixed(2))
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Risk score calculated: ${result.risk_score}`);
}

main();
