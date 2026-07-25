import os
import json
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
SCORES_TABLE_NAME = os.environ['SCORES_TABLE_NAME']
scores_table = dynamodb.Table(SCORES_TABLE_NAME)


def lambda_handler(event, context):
    """
    Receives a principal ARN from the response state machine.
    Attempts to resolve it to a Cognito username stored in the trust scores table.
    Returns { cognito_username, user_pool_id } or { skip_revocation: True }
    for headless service roles that have no associated Cognito user.
    """
    logger.info(f"Identity lookup for: {json.dumps(event)}")

    principal = event.get('principal', '')
    cognito_user_pool_id = os.environ.get('COGNITO_USER_POOL_ID', '')

    if not principal:
        logger.warning("No principal provided — skipping revocation")
        return {"skip_revocation": True, "reason": "no_principal"}

    try:
        response = scores_table.get_item(Key={"principal": principal})
        item = response.get('Item')

        if not item:
            logger.info(f"No trust score record for {principal} — may be headless role")
            return {
                "skip_revocation": True,
                "reason": "no_trust_score_record",
                "principal": principal
            }

        cognito_sub = item.get('cognito_sub')
        cognito_username = item.get('cognito_username')

        if not cognito_username and not cognito_sub:
            logger.info(f"No Cognito identity in trust score for {principal} — headless role")
            return {
                "skip_revocation": True,
                "reason": "headless_role",
                "principal": principal
            }

        return {
            "skip_revocation": False,
            "cognito_username": cognito_username or cognito_sub,
            "user_pool_id": cognito_user_pool_id,
            "principal": principal
        }

    except Exception as e:
        logger.error(f"DynamoDB lookup failed for {principal}: {e}")
        # Fail safe — skip revocation rather than crashing the whole playbook
        return {
            "skip_revocation": True,
            "reason": "lookup_error",
            "principal": principal
        }
