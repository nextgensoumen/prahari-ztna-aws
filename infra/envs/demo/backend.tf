terraform {
  backend "s3" {
    bucket       = "prahari-tf-state-REPLACE_ACCOUNT_ID-us-east-1"
    key          = "envs/demo/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}
