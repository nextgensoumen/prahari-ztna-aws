# ---------------------------------------------------------------------------------------------------------------------
# VERIFIED PERMISSIONS (CEDAR) POLICY STORE
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_verifiedpermissions_policy_store" "main" {
  description = "Prahari ZTNA Cedar policy store"

  validation_settings {
    mode = "STRICT"
  }
}

# Cedar schema defining entity types
resource "aws_verifiedpermissions_schema" "main" {
  policy_store_id = aws_verifiedpermissions_policy_store.main.policy_store_id

  definition {
    value = jsonencode({
      "PrahariApp" = {
        entityTypes = {
          User = {
            shape = {
              type = "Record"
              attributes = {
                sub = {
                  type     = "String"
                  required = true
                }
                email = {
                  type     = "String"
                  required = true
                }
                "cognito:groups" = {
                  type     = "String"
                  required = false
                }
                trust_score = {
                  type     = "Long"
                  required = false
                }
              }
            }
            memberOfTypes = ["Group"]
          }
          Group = {
            shape = {
              type       = "Record"
              attributes = {}
            }
          }
          Application = {
            shape = {
              type       = "Record"
              attributes = {}
            }
          }
        }
        actions = {
          Access = {
            appliesTo = {
              principalTypes = ["User"]
              resourceTypes  = ["Application"]
            }
          }
        }
      }
    })
  }
}

# Admins can access everything
resource "aws_verifiedpermissions_policy" "admins" {
  policy_store_id = aws_verifiedpermissions_policy_store.main.policy_store_id

  definition {
    static {
      description = "Members of prahari-admins group can access all applications"
      statement   = <<-CEDAR
        permit (
          principal in PrahariApp::Group::"prahari-admins",
          action == PrahariApp::Action::"Access",
          resource
        );
      CEDAR
    }
  }
}

# Standard users can access user-facing apps only when trust score is acceptable
resource "aws_verifiedpermissions_policy" "users" {
  policy_store_id = aws_verifiedpermissions_policy_store.main.policy_store_id

  definition {
    static {
      description = "Members of prahari-users group can access user-facing applications"
      statement   = <<-CEDAR
        permit (
          principal in PrahariApp::Group::"prahari-users",
          action == PrahariApp::Action::"Access",
          resource == PrahariApp::Application::"user-portal"
        );
      CEDAR
    }
  }
}

# Explicit deny for high-risk sessions (trust_score >= threshold)
resource "aws_verifiedpermissions_policy" "deny_high_risk" {
  policy_store_id = aws_verifiedpermissions_policy_store.main.policy_store_id

  definition {
    static {
      description = "Deny access when session trust score exceeds the risk threshold"
      statement   = <<-CEDAR
        forbid (
          principal,
          action == PrahariApp::Action::"Access",
          resource
        ) when {
          principal.trust_score > ${var.risk_score_threshold}
        };
      CEDAR
    }
  }
}
