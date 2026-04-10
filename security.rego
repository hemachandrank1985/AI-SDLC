package security

default allow = false

# Threshold for risk score
risk_threshold := 60.0

# Fail if any critical/high SAST findings exist
deny_sast[msg] {
    some i
    finding := input.findings.sast[i]
    finding.severity == "HIGH"
    msg := sprintf("Policy SEC-001: High severity SAST finding detected (%v)", [finding.id])
}

# Fail if any critical/high DAST findings exist
deny_dast[msg] {
    some i
    finding := input.findings.dast[i]
    finding.severity == "HIGH"
    msg := sprintf("Policy SEC-002: High severity DAST finding detected (%v)", [finding.id])
}

# Fail if any critical/high SCA findings exist
deny_sca[msg] {
    some i
    finding := input.findings.sca[i]
    finding.severity == "HIGH"
    msg := sprintf("Policy SEC-003: High severity SCA finding detected (%v)", [finding.id])
}

# Fail if risk score exceeds threshold
deny_risk[msg] {
    input.risk_score > risk_threshold
    msg := sprintf("Policy SEC-005: Total risk score %v exceeds threshold %v", [input.risk_score, risk_threshold])
}

# Aggregate all violations
violations[msg] {
    deny_sast[msg]
}
violations[msg] {
    deny_dast[msg]
}
violations[msg] {
    deny_sca[msg]
}
violations[msg] {
    deny_risk[msg]
}

# Final decision
allow {
    count(violations) == 0
}
