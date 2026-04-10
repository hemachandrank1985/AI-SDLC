package security

test_allow_clean_code {
    allow with input as {
        "risk_score": 10.0,
        "findings": {
            "sast": [],
            "sca": [{"id": "npm:123", "severity": "LOW"}],
            "dast": []
        }
    }
}

test_deny_high_sast {
    not allow with input as {
        "risk_score": 20.0,
        "findings": {
            "sast": [{"id": "js/sql-injection", "severity": "HIGH"}],
            "sca": [],
            "dast": []
        }
    }
}

test_deny_high_risk_score {
    not allow with input as {
        "risk_score": 75.0,
        "findings": {
            "sast": [{"id": "js/xss", "severity": "MEDIUM"}],
            "sca": [{"id": "npm:456", "severity": "MEDIUM"}],
            "dast": [{"id": "zap:123", "severity": "MEDIUM"}]
        }
    }
}
