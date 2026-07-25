import boto3
import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

iam = boto3.client('iam')
secretsmanager = boto3.client('secretsmanager')

GITHUB_REPO = os.environ.get('GITHUB_REPO')
SECRET_ARN = os.environ.get('SECRET_ARN')

def get_github_token():
    try:
        response = secretsmanager.get_secret_value(SecretId=SECRET_ARN)
        return response['SecretString']
    except Exception as e:
        logger.error("Failed to retrieve GitHub token")
        raise e

def api_request(method, url, token, data=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Prahari-Policy-Diff-Bot',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    
    req_data = None
    if data:
        req_data = json.dumps(data).encode('utf-8')
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        logger.error(f"GitHub API Error: {e.code} - {body}")
        raise e

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    
    principal_arn = event.get('principalArn')
    policy_result = event.get('policyResult', {})
    
    if not principal_arn:
        logger.error("No principalArn provided in event.")
        return {"status": "error", "message": "No principalArn"}
        
    role_name = principal_arn.split('/')[-1]
    
    # 1. Scope Safety: Check if role is managed by Prahari
    try:
        role_details = iam.get_role(RoleName=role_name)['Role']
        tags = {t['Key']: t['Value'] for t in role_details.get('Tags', [])}
        if tags.get('prahari:managed') != 'true':
            logger.info(f"Role {role_name} is not managed by Prahari (missing tag prahari:managed = true). Aborting.")
            return {"status": "skipped", "message": "Role not tagged as prahari:managed = true"}
    except Exception as e:
        logger.error(f"Failed to fetch role {role_name}: {e}")
        return {"status": "error", "message": str(e)}

    # 2. Extract Generated Policy
    try:
        generated_policies = policy_result['generatedPolicyResult']['generatedPolicies']
        if not generated_policies:
            logger.info(f"No permissions found in CloudTrail for {role_name}.")
            generated_policy_json = '{"Version": "2012-10-17", "Statement": []}'
        else:
            generated_policy_json = generated_policies[0]['policy']
        
        generated_policy = json.loads(generated_policy_json)
    except (KeyError, IndexError) as e:
        logger.error(f"Failed to parse generated policy from event: {e}")
        return {"status": "error", "message": "Invalid policyResult structure"}

    # 3. Open GitHub PR
    token = get_github_token()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    branch_name = f"autopilot/least-priv-{role_name}-{timestamp}"
    file_path = f"infra/generated-policies/{role_name}.json"
    
    base_url = f"https://api.github.com/repos/{GITHUB_REPO}"
    
    try:
        # Get default branch SHA
        repo_info = api_request('GET', base_url, token)
        default_branch = repo_info['default_branch']
        
        ref_info = api_request('GET', f"{base_url}/git/ref/heads/{default_branch}", token)
        base_sha = ref_info['object']['sha']
        
        # Create new branch
        api_request('POST', f"{base_url}/git/refs", token, data={
            "ref": f"refs/heads/{branch_name}",
            "sha": base_sha
        })
        
        # Check if file exists to get SHA for update
        file_sha = None
        try:
            file_info = api_request('GET', f"{base_url}/contents/{file_path}", token)
            file_sha = file_info['sha']
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise e
        
        import base64
        content = json.dumps(generated_policy, indent=2) + "\n"
        b64_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        
        file_data = {
            "message": f"🤖 Autopilot: Tighten IAM policy for {role_name}",
            "content": b64_content,
            "branch": branch_name
        }
        if file_sha:
            file_data["sha"] = file_sha
            
        api_request('PUT', f"{base_url}/contents/{file_path}", token, data=file_data)
        
        # Create PR
        pr_body = (
            f"## 🤖 Least Privilege Autopilot\n\n"
            f"IAM Access Analyzer has generated a tighter policy for `{role_name}` based on CloudTrail activity.\n\n"
            f"### Proposed Changes\n"
            f"Please review the proposed policy in `infra/generated-policies/{role_name}.json`.\n"
            f"This policy is based on actual usage over the past period.\n\n"
            f"**Note:** Do not merge this PR directly if your Terraform manages the inline policies. "
            f"Use this as a reference to manually update your Terraform HCL, then close this PR."
        )
        
        pr_data = {
            "title": f"Least Privilege: Update policy for {role_name}",
            "body": pr_body,
            "head": branch_name,
            "base": default_branch
        }
        
        pr_response = api_request('POST', f"{base_url}/pulls", token, data=pr_data)
        pr_url = pr_response['html_url']
        
        logger.info(f"Successfully opened PR: {pr_url}")
        return {"status": "success", "pr_url": pr_url}
        
    except Exception as e:
        logger.error(f"GitHub operation failed: {e}")
        return {"status": "error", "message": "GitHub API interaction failed"}
