import os
import json
import logging
import boto3
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
sfn = boto3.client('stepfunctions')

EVENTS_TABLE = os.environ.get('EVENTS_TABLE_NAME', '')
SCORES_TABLE = os.environ.get('TRUST_SCORES_TABLE_NAME', '')
RESPONSE_SM  = os.environ.get('RESPONSE_STATE_MACHINE_ARN', '')
GITHUB_REPO  = os.environ.get('GITHUB_REPO', 'nextgensoumen/prahari-ztna-aws')
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', '*')

events_table = dynamodb.Table(EVENTS_TABLE)
scores_table = dynamodb.Table(SCORES_TABLE)


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def respond(status_code, body, extra_headers=None):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    }
    if extra_headers:
        headers.update(extra_headers)
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, default=decimal_default)
    }


def get_cognito_claims(event):
    """Extract user identity and groups from the Cognito JWT claims."""
    try:
        claims = event['requestContext']['authorizer']['claims']
        groups = claims.get('cognito:groups', '')
        group_list = groups.split(',') if groups else []
        return {
            'sub': claims.get('sub', ''),
            'email': claims.get('email', ''),
            'groups': group_list,
            'is_admin': 'prahari-admins' in group_list
        }
    except (KeyError, TypeError):
        return {'sub': '', 'email': '', 'groups': [], 'is_admin': False}


def handle_findings(user):
    """GET /findings — Admin only. Returns recent events from DynamoDB."""
    if not user['is_admin']:
        return respond(403, {'error': 'Forbidden — admin role required'})

    items = []
    for severity in ('critical', 'high', 'medium', 'low'):
        resp = events_table.query(
            IndexName='SeverityIndex',
            KeyConditionExpression='severity = :s',
            ExpressionAttributeValues={':s': severity},
            ScanIndexForward=False,
            Limit=25
        )
        items.extend(resp.get('Items', []))

    items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return respond(200, {'findings': items[:50]})


def handle_sessions(user, principal_filter=None):
    """GET /sessions — Admin sees all; user sees own."""
    if user['is_admin']:
        resp = scores_table.scan(Limit=100)
        sessions = resp.get('Items', [])
    else:
        resp = scores_table.get_item(Key={'principal': user['email']})
        item = resp.get('Item')
        sessions = [item] if item else []

    return respond(200, {'sessions': sessions})


def handle_revoke(user, body):
    """POST /sessions/revoke — Admin only. Triggers response state machine."""
    if not user['is_admin']:
        return respond(403, {'error': 'Forbidden — admin role required'})

    principal = body.get('principal')
    if not principal:
        return respond(400, {'error': 'principal is required'})

    sfn.start_execution(
        stateMachineArn=RESPONSE_SM,
        input=json.dumps({
            'principal': principal,
            'score': 100,
            'triggered_rules': ['manual_admin_revoke'],
            'source': 'dashboard_manual'
        })
    )
    return respond(200, {'status': 'revocation_triggered', 'principal': principal})


def handle_pipeline(user):
    """GET /pipeline — Admin only. Simulated pipeline status."""
    if not user['is_admin']:
        return respond(403, {'error': 'Forbidden — admin role required'})

    simulated = [
        {'id': 'build-001', 'status': 'SUCCEEDED', 'repo': GITHUB_REPO,
         'sha': 'a3f2c1d', 'timestamp': '2026-07-25T06:00:00Z',
         'image': 'prahari-repo:a3f2c1d', 'signed': True},
        {'id': 'build-002', 'status': 'IN_PROGRESS', 'repo': GITHUB_REPO,
         'sha': 'b7e9d4a', 'timestamp': '2026-07-25T07:10:00Z',
         'image': 'prahari-repo:b7e9d4a', 'signed': False},
    ]
    return respond(200, {'pipeline': simulated})


def handle_me(user):
    """GET /me — Own trust score and session info."""
    resp = scores_table.get_item(Key={'principal': user['email']})
    item = resp.get('Item', {
        'principal': user['email'],
        'score': 0,
        'is_high_risk': False,
        'triggered_rules': [],
        'timestamp': 'No data yet'
    })
    return respond(200, {
        'user': {
            'email': user['email'],
            'groups': user['groups'],
            'is_admin': user['is_admin']
        },
        'trust': item
    })


def handle_policies(user):
    """GET /policies — Admin only. Lists open policy-diff PRs from GitHub."""
    if not user['is_admin']:
        return respond(403, {'error': 'Forbidden — admin role required'})
    # Placeholder — a real implementation would call the GitHub API
    return respond(200, {'policies': [], 'note': 'Fetched via policy-diff-bot PRs'})


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '/')
    user   = get_cognito_claims(event)

    logger.info(f"{method} {path} — user: {user['email']} admin: {user['is_admin']}")

    try:
        if path == '/findings' and method == 'GET':
            return handle_findings(user)
        elif path == '/sessions' and method == 'GET':
            return handle_sessions(user)
        elif path == '/sessions/revoke' and method == 'POST':
            body = json.loads(event.get('body') or '{}')
            return handle_revoke(user, body)
        elif path == '/pipeline' and method == 'GET':
            return handle_pipeline(user)
        elif path == '/me' and method == 'GET':
            return handle_me(user)
        elif path == '/policies' and method == 'GET':
            return handle_policies(user)
        else:
            return respond(404, {'error': f'Route not found: {method} {path}'})
    except Exception as e:
        logger.error(f"Handler error: {e}", exc_info=True)
        return respond(500, {'error': 'Internal server error'})
