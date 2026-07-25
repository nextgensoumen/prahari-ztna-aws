import boto3
import os
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

iam = boto3.client('iam')
sfn = boto3.client('stepfunctions')

STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']

def lambda_handler(event, context):
    logger.info("Starting role discovery for policy generation")
    
    paginator = iam.get_paginator('list_roles')
    roles_processed = 0
    
    for page in paginator.paginate():
        for role in page['Roles']:
            role_name = role['RoleName']
            role_arn = role['Arn']
            
            # Skip AWS managed service roles automatically
            if role_name.startswith('aws-') or role_name.startswith('AWSServiceRole'):
                continue
                
            try:
                # We need to get the role individually to ensure we have all tags
                role_details = iam.get_role(RoleName=role_name)['Role']
                tags = {t['Key']: t['Value'] for t in role_details.get('Tags', [])}
                
                if tags.get('prahari:managed') == 'true':
                    logger.info(f"Triggering policy generation for {role_name}")
                    sfn.start_execution(
                        stateMachineArn=STATE_MACHINE_ARN,
                        input=json.dumps({"principalArn": role_arn})
                    )
                    roles_processed += 1
            except Exception as e:
                logger.error(f"Error processing role {role_name}: {e}")
                
    logger.info(f"Discovery complete. Triggered {roles_processed} roles.")
    return {"status": "success", "triggered": roles_processed}
