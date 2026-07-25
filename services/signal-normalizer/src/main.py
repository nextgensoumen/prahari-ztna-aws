import os
import json
import logging
import boto3
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'prahari-platform-events')
table = dynamodb.Table(table_name)

def get_guardduty_severity(score):
    if score < 4.0:
        return 'low'
    elif score < 7.0:
        return 'medium'
    elif score < 9.0:
        return 'high'
    else:
        return 'critical'

def normalize_guardduty(event):
    detail = event.get('detail', {})
    
    # Extract principal
    principal = "unknown"
    resource = detail.get('resource', {})
    resource_type = resource.get('resourceType')
    
    if resource_type == 'AccessKey':
        principal = resource.get('accessKeyDetails', {}).get('userName', 'unknown')
    elif resource_type == 'Instance':
        principal = resource.get('instanceDetails', {}).get('instanceId', 'unknown')
        
    return {
        'event_id': event['id'],
        'source_module': 'guardduty',
        'severity': get_guardduty_severity(detail.get('severity', 0)),
        'principal': principal,
        'resource': detail.get('arn', 'unknown'),
        'title': detail.get('title', 'GuardDuty Finding'),
        'description': detail.get('description', ''),
        'timestamp': event['time'],
        'raw': json.dumps(event)
    }

def normalize_securityhub(event):
    detail = event.get('detail', {})
    findings = detail.get('findings', [{}])
    finding = findings[0] if findings else {}
    
    severity_label = finding.get('Severity', {}).get('Label', 'INFORMATIONAL').lower()
    if severity_label == 'informational':
        severity_label = 'low'
        
    resources = finding.get('Resources', [{}])
    resource_id = resources[0].get('Id', 'unknown') if resources else 'unknown'
    
    return {
        'event_id': event['id'],
        'source_module': 'securityhub',
        'severity': severity_label,
        'principal': finding.get('AwsAccountId', 'unknown'),
        'resource': resource_id,
        'title': finding.get('Title', 'SecurityHub Finding'),
        'description': finding.get('Description', ''),
        'timestamp': event['time'],
        'raw': json.dumps(event)
    }

def normalize_cloudtrail(event):
    detail = event.get('detail', {})
    user_identity = detail.get('userIdentity', {})
    
    principal = user_identity.get('arn', user_identity.get('userName', 'unknown'))
    
    # CloudTrail is usually informational, but these specific events are monitored as high-signal
    severity = 'low'
    event_name = detail.get('eventName', '')
    
    if event_name in ['DeleteTrail', 'StopLogging']:
        severity = 'critical'
    elif event_name in ['AttachRolePolicy', 'PutRolePolicy']:
        severity = 'high'
        
    return {
        'event_id': event['id'],
        'source_module': 'cloudtrail',
        'severity': severity,
        'principal': principal,
        'resource': detail.get('eventSource', 'unknown'),
        'title': f"CloudTrail: {event_name}",
        'description': f"User {principal} performed {event_name}",
        'timestamp': event['time'],
        'raw': json.dumps(event)
    }

def normalize_prahari(event):
    detail = event.get('detail', {})
    
    return {
        'event_id': event['id'],
        'source_module': 'prahari',
        'severity': detail.get('severity', 'info').lower(),
        'principal': detail.get('principal', 'system'),
        'resource': detail.get('resource', 'system'),
        'title': detail.get('title', 'Prahari Platform Event'),
        'description': detail.get('description', ''),
        'timestamp': event['time'],
        'raw': json.dumps(event)
    }

def lambda_handler(event, context):
    logger.info(f"Received event from {event.get('source')}")
    
    source = event.get('source', '')
    
    try:
        if source == 'aws.guardduty':
            normalized = normalize_guardduty(event)
        elif source == 'aws.securityhub':
            normalized = normalize_securityhub(event)
        elif source == 'aws.cloudtrail':
            normalized = normalize_cloudtrail(event)
        else:
            normalized = normalize_prahari(event)
            
        logger.info(f"Writing normalized event {normalized['event_id']} to DynamoDB")
        table.put_item(Item=normalized)
        
        return {"status": "success", "event_id": normalized['event_id']}
        
    except Exception as e:
        logger.error(f"Error processing event: {str(e)}")
        logger.error(f"Raw event: {json.dumps(event)}")
        raise e
