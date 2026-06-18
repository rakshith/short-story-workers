## Database Schema

### autopilot_schedules
Stores per-user autopilot configuration.

```sql
CREATE TABLE autopilot_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  enabled BOOLEAN DEFAULT false,
  frequency_per_day INTEGER DEFAULT 1 CHECK (frequency_per_day BETWEEN 1 AND 5),
  preferred_hours INTEGER[] DEFAULT '{9}',  -- Hours in UTC (0-23)
  preferred_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',  -- 0=Sunday, 6=Saturday
  content_source TEXT DEFAULT 'trending' CHECK (content_source IN ('trending', 'themes', 'random')),
  preferred_themes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### autopilot_history
Tracks all autopilot-generated stories.

```sql
CREATE TABLE autopilot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  story_id UUID REFERENCES stories(id),
  scheduled_for TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  failure_reason TEXT,
  credits_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### autopilot_daily_usage
Enforces per-user daily quotas.

```sql
CREATE TABLE autopilot_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stories_generated INTEGER DEFAULT 0,
  UNIQUE(user_id, usage_date)
);
```

### trending_topics
Caches trending content for autopilot generation.

```sql
CREATE TABLE trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('internal', 'external', 'hybrid')),
  score DECIMAL(10,2),
  metadata JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trending_topics_expires ON trending_topics(expires_at);
CREATE INDEX idx_trending_topics_score ON trending_topics(score DESC);
```

## RLS Policies

```sql
-- Users can only read their own autopilot schedules
ALTER TABLE autopilot_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own autopilot" ON autopilot_schedules
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only read their own autopilot history
ALTER TABLE autopilot_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own autopilot history" ON autopilot_history
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all autopilot data
CREATE POLICY "Service role manages autopilot" ON autopilot_schedules
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages autopilot history" ON autopilot_history
  FOR ALL USING (auth.role() = 'service_role');
```