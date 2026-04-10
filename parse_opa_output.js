const fs = require('fs');

function main() {
  const rawPath = process.argv[2];
  const outPath = process.argv[3];
  
  if (!fs.existsSync(rawPath)) {
    console.error("OPA raw output not found");
    process.exit(1);
  }

  try {
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    
    // Safely extract OPA result using optional chaining
    const securityData = raw?.result?.[0]?.expressions?.[0]?.value || { 
      allow: false, 
      violations: ["OPA evaluation failed or returned empty data"] 
    };
    
    const isAllowed = securityData.allow === true;
    const violations = securityData.violations || [];
    
    const decision = {
      decision: isAllowed ? "ALLOW" : "DENY",
      violations: violations,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(outPath, JSON.stringify(decision, null, 2));
    console.log(`Decision parsed: ${decision.decision}`);
  } catch (error) {
    console.error("Error parsing OPA output:", error);
    // Write a fallback DENY decision so the pipeline doesn't crash but fails securely
    const fallback = {
      decision: "DENY",
      violations: ["Fatal error parsing OPA output: " + error.message],
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(outPath, JSON.stringify(fallback, null, 2));
    process.exit(1);
  }
}

main();
