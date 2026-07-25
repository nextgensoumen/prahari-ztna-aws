variable "github_repo" {
  description = "GitHub repository in the format org/repo (e.g., nextgensoumen/prahari-ztna-aws)"
  type        = string
  default     = "nextgensoumen/prahari-ztna-aws"
}

variable "github_thumbprints" {
  description = "List of GitHub OIDC thumbprints"
  type        = list(string)
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}
