# Debugging and Monitoring Guide

This guide explains how to debug and monitor the Cloudflare Workers queue consumer and API calls.

## Table of Contents
1. [Viewing Logs](#viewing-logs)
2. [Local Development Debugging](#local-development-debugging)
3. [Production Monitoring](#production-monitoring)
4. [Understanding Log Format](#understanding-log-format)
5. [Common Issues](#common-issues)

## Viewing Logs

### Local Development

When running `wrangler dev`, logs appear in your terminal. The enhanced logging includes:

- **Timestamps**: ISO format timestamps for each log entry
- **Module prefixes**: `[Queue Consumer]`, `[Queue Processor]`, `[API]`
- **Log levels**: `INFO`, `DEBUG`, `WARN`, `ERROR`
- **Context**: JSON objects with relevant data (jobId, sceneIndex, etc.)
- **API timing**: Duration in milliseconds for API calls

**Example log output:**
```
2024-01-15T10:30:45.123Z [Queue Consumer] [INFO] Queue batch received {"batchSize":3,"queue":"story-processing"}
2024-01-15T10:30:45.124Z [Queue Consumer] [INFO] Processing message {"messageId":"abc123","type":"image","jobId":"job-123","sceneIndex":0}
2024-01-15T10:30:45.125Z [Queue Processor] [DEBUG] Image generation starting {"sceneIndex":0,"model":"black-forest-labs/flux-schnell"}
2024-01-15T10:30:50.456Z [Queue Processor] [INFO] API Call Success: generateAndUploadImages {"duration":"5331ms"}
```

### Viewing Logs in Production

#### Using Wrangler CLI

```bash
# View real-time logs
wrangler tail

# View logs with filters
wrangler tail --format pretty

# Filter by log level
wrangler tail | grep ERROR

# Save logs to file
wrangler tail > logs.txt
```

#### Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Navigate to **Workers & Pages**
4. Click on your worker
5. Go to **Logs** tab
6. Use filters to search by:
   - Log level (INFO, ERROR, etc.)
   - Text search (jobId, sceneIndex, etc.)
   - Time range

#### Using Cloudflare API

```bash
# Get logs via API (requires API token)
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}/logs" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Local Development Debugging

### 1. Enable Verbose Logging

The logger automatically includes detailed context. To see even more details, check the `DEBUG` level logs:

```bash
wrangler dev | grep DEBUG
```

### 2. Monitor Queue Status

Check the queue status in your database:

```sql
SELECT * FROM story_jobs 
WHERE job_id = 'your-job-id' 
ORDER BY updated_at DESC;
```

### 3. Test Individual Components

You can test API calls directly:

```typescript
// Test Replicate API
const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });
const output = await replicate.run('black-forest-labs/flux-schnell', {
  input: { prompt: 'test prompt' }
});
console.log('Replicate output:', output);
```

### 4. Debug Specific Messages

Add breakpoints or additional logging:

```typescript
// In queue-consumer.ts
if (data.jobId === 'debug-job-id') {
  console.log('DEBUG: Full message data:', JSON.stringify(data, null, 2));
}
```

## Production Monitoring

### 1. Set Up Alerts

Create alerts for:
- High error rates
- Long processing times
- Failed API calls
- Queue backlog

### 2. Monitor Queue Metrics

Check queue metrics in Cloudflare Dashboard:
- **Queue depth**: Number of messages waiting
- **Processing rate**: Messages processed per minute
- **Error rate**: Percentage of failed messages
- **Retry count**: How many times messages are retried

### 3. Track API Performance

The logger automatically tracks:
- API call duration
- Success/failure rates
- Error details

Look for patterns:
```bash
# Find slow API calls
wrangler tail | grep "duration" | grep -E "[0-9]{4,}ms"

# Find failed API calls
wrangler tail | grep "API Call Failed"
```

## Understanding Log Format

### Log Structure

Each log entry follows this format:
```
[TIMESTAMP] [MODULE] [LEVEL] [MESSAGE] [CONTEXT_JSON]
```

**Example:**
```
2024-01-15T10:30:45.123Z [Queue Consumer] [INFO] Processing message {"messageId":"abc","type":"image","jobId":"job-123","sceneIndex":0}
```

### Log Levels

- **INFO**: Normal operations, successful processing
- **DEBUG**: Detailed information for debugging
- **WARN**: Warning conditions (e.g., story not found)
- **ERROR**: Error conditions with full stack traces

### Context Fields

Common context fields:
- `messageId`: Unique message identifier
- `jobId`: Job identifier
- `sceneIndex`: Scene number being processed
- `userId`: User identifier
- `type`: Message type (image, audio, finalize)
- `duration`: Processing time in milliseconds
- `success`: Boolean indicating success
- `error`: Error message if failed

## Common Issues

### 1. API Authentication Errors

**Symptom:**
```
[ERROR] API Call Failed: generateAndUploadImages {"status":401}
```

**Solution:**
- Check `.dev.vars` file has correct `REPLICATE_API_TOKEN`
- Verify token is set in production: `wrangler secret list`
- Ensure token hasn't expired

### 2. Slow Processing

**Symptom:**
```
[INFO] API Call Success: generateAndUploadImages {"duration":"45000ms"}
```

**Solution:**
- Check Replicate API status
- Monitor network latency
- Consider using faster models for development

### 3. Queue Messages Not Processing

**Symptom:**
- Messages stuck in queue
- No logs appearing

**Solution:**
- Check queue consumer is running: `wrangler tail`
- Verify queue binding in `wrangler.toml`
- Check for errors preventing message acknowledgment

### 4. Database Connection Issues

**Symptom:**
```
[ERROR] Failed to fetch story {"error":"connection timeout"}
```

**Solution:**
- Verify Supabase credentials in `.dev.vars`
- Check Supabase service status
- Verify network connectivity

## Useful Commands

```bash
# Watch logs in real-time
wrangler tail --format pretty

# Filter for specific job
wrangler tail | grep "job-123"

# Count errors
wrangler tail | grep ERROR | wc -l

# Find slow operations
wrangler tail | grep "duration" | awk -F'"duration":"' '{print $2}' | sort -n

# Export logs for analysis
wrangler tail > logs.json
```

## Best Practices

1. **Use structured logging**: Always include context (jobId, sceneIndex, etc.)
2. **Monitor error rates**: Set up alerts for high error rates
3. **Track performance**: Monitor API call durations
4. **Log important state changes**: Job status updates, scene completions
5. **Include request IDs**: Makes tracing easier across services

## Additional Resources

- [Cloudflare Workers Logs Documentation](https://developers.cloudflare.com/workers/observability/logs/)
- [Wrangler Tail Documentation](https://developers.cloudflare.com/workers/wrangler/commands/#tail)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)

