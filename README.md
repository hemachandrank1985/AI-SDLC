# AG-SDLC DevSecOps Prototype

This repository contains a minimal, reproducible end-to-end prototype of an AI-governed DevSecOps pipeline based on the AG-SDLC concept.

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── ag-sdlc-pipeline.yml   # CI/CD Pipeline definition (with Vercel Deploy)
├── governance/
│   └── policies/
│       ├── security.rego          # OPA Policies for gating
│       └── security_test.rego     # OPA Policy tests
├── public/
│   └── sample-data/               # Mock data for the dashboard
│       ├── findings.json          # Aggregated security findings
│       ├── opa_decision.json      # OPA evaluation result
│       └── evidence_log.json      # Tamper-evident hash chain log
├── scripts/
│   ├── evidence_logger.js         # Appends to the evidence log with SHA-256
│   ├── experiment_metrics.js      # Calculates experiment metrics
│   ├── parse_opa_output.js        # Parses raw OPA output to JSON
│   └── risk_scoring.js            # Calculates risk score based on findings
├── src/
│   └── App.tsx                    # React Dashboard Code
├── vercel.json                    # Vercel SPA routing configuration
└── package.json
```

## 🚀 How to Run

### 1. Local Dashboard
To view the Explainability Dashboard locally:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. The dashboard will load the sample data from `public/sample-data/`.

### 2. GitHub Actions Pipeline & Vercel Deployment
To run the pipeline and deploy to Vercel:
1. Push this repository to GitHub.
2. Ensure the following secrets are configured in your GitHub repository for Vercel deployment:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. The pipeline defined in `.github/workflows/ag-sdlc-pipeline.yml` will trigger automatically on `push` or `pull_request` to the `main` branch.
4. The pipeline integrates:
   - **SAST**: CodeQL (clones Juice Shop dynamically)
   - **SCA**: npm audit
   - **DAST**: OWASP ZAP (Baseline Scan against a temporary Juice Shop container)
   - **Governance**: Open Policy Agent (OPA)
   - **Compliance**: Evidence Logging
   - **Deployment**: Deploys the Explainability Dashboard to Vercel *before* enforcing the final gate, ensuring visibility into failed runs.

### 3. OPA Policy Testing
To test the OPA policies locally (requires OPA installed):
```bash
opa test governance/policies/ -v
```

### 4. Risk Scoring
To test the risk scoring logic manually:
```bash
node scripts/risk_scoring.js public/sample-data/findings.json public/sample-data/risk_score.json
```

## 🧪 Experiment Design & Data Collection

To collect metrics for evaluating the AG-SDLC prototype, run the experiment script:

```bash
node scripts/experiment_metrics.js
```

### Metrics Collected:
1. **Detection Count per Tool**: Extracted from `findings.json`.
2. **False Positives**: Simulated via a heuristic (e.g., 10% of total findings). In a real scenario, this requires manual tagging.
3. **Pipeline Runtime**: Simulated in the script. For real data, check the execution time of the GitHub Actions workflow runs.
4. **Governance Decision Latency**: Measured by timing the OPA evaluation and risk scoring steps.

## 🔐 Compliance Layer (Evidence Log)

The pipeline automatically appends a tamper-evident record to `evidence_log.json` after every run. It uses SHA-256 hash chaining:
`New Hash = SHA256(Previous Hash + Current Run Data)`

You can manually trigger a log append:
```bash
node scripts/evidence_logger.js public/sample-data/evidence_log.json public/sample-data/opa_decision.json
```
