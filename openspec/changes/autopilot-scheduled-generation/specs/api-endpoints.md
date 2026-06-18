## API Endpoints

### POST /autopilot/configure
Configure autopilot preferences for a user.

**Request:**
```json
{
  "enabled": true,
  "frequency_per_day": 2,
  "preferred_hours": [9, 18],
  "preferred_days": [0, 1, 2, 3, 4, 5, 6],
  "content_source": "trending",
  "preferred_themes": ["sci-fi", "fantasy"]
}
```

**Response (200):**
```json
{
  "success": true,
  "schedule": {
    "id": "uuid",
    "user_id": "uuid",
    "enabled": true,
    "frequency_per_day": 2,
    "next_generation": "2026-06-03T09:00:00Z"
  }
}
```

**Errors:**
- 400: Invalid configuration (frequency not 1-5, invalid hours/days)
- 401: Unauthorized
- 409: User has pending autopilot generation

### GET /autopilot/status
Get current autopilot status and history.

**Response (200):**
```json
{
  "schedule": {
    "enabled": true,
    "frequency_per_day": 2,
    "preferred_hours": [9, 18],
    "content_source": "trending"
  },
  "usage_today": 1,
  "quota_remaining": 1,
  "recent_generations": [
    {
      "id": "uuid",
      "story_id": "uuid",
      "status": "completed",
      "generated_at": "2026-06-02T09:00:00Z"
    }
  ]
}
```

### POST /autopilot/enable
Quick enable autopilot with default settings.

**Response (200):**
```json
{
  "success": true,
  "message": "Autopilot enabled. First generation scheduled for next preferred hour."
}
```

### POST /autopilot/disable
Disable autopilot (soft delete - preserves history).

**Response (200):**
```json
{
  "success": true,
  "message": "Autopilot disabled. Pending generations will complete."
}
```

## Rate Limits
- Configure: 10 requests/hour per user
- Status: 60 requests/hour per user
- Enable/Disable: 10 requests/hour per user