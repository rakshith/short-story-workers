## Trending Content Service

### Hybrid Approach

Combines internal popularity metrics with external trending topics.

### Internal Source

Query Supabase for popular stories:

```sql
SELECT 
  unnest(themes) as theme,
  COUNT(*) as view_count,
  AVG(likes) as avg_likes
FROM stories
WHERE created_at > NOW() - INTERVAL '7 days'
  AND status = 'completed'
GROUP BY theme
ORDER BY view_count DESC, avg_likes DESC
LIMIT 20;
```

### External Source

Configurable external APIs (implementation detail):

```typescript
interface ExternalTrendingSource {
  name: string;
  fetch: () => Promise<TrendingTopic[]>;
  enabled: boolean;
}

// Example sources (to be configured)
const externalSources: ExternalTrendingSource[] = [
  // Google Trends API
  // Twitter/X trending topics
  // Reddit trending
  // News APIs
];
```

### Merge Algorithm

```typescript
function mergeTrendingTopics(
  internal: TrendingTopic[],
  external: TrendingTopic[]
): TrendingTopic[] {
  const merged = new Map<string, TrendingTopic>();
  
  // Weight internal topics higher (more relevant to platform)
  internal.forEach(topic => {
    merged.set(topic.theme, {
      ...topic,
      score: topic.score * 1.5  // 50% boost for internal
    });
  });
  
  // Add external topics
  external.forEach(topic => {
    const existing = merged.get(topic.theme);
    if (existing) {
      existing.score += topic.score;
      existing.sources.push('external');
    } else {
      merged.set(topic.theme, topic);
    }
  });
  
  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}
```

### Caching

- Cache duration: 1 hour
- Stored in `trending_topics` table
- Expired entries cleaned up by scheduler

### Topic Selection for Generation

```typescript
function selectTopicForUser(
  topics: TrendingTopic[],
  userPreferences: AutopilotSchedule
): string {
  // Filter by user's preferred themes if set
  let candidates = topics;
  if (userPreferences.preferred_themes.length > 0) {
    candidates = topics.filter(t => 
      userPreferences.preferred_themes.includes(t.theme)
    );
  }
  
  // Random selection from top 10 with weight by score
  const top10 = candidates.slice(0, 10);
  const totalScore = top10.reduce((sum, t) => sum + t.score, 0);
  let random = Math.random() * totalScore;
  
  for (const topic of top10) {
    random -= topic.score;
    if (random <= 0) return topic.theme;
  }
  
  return top10[0].theme;
}
```