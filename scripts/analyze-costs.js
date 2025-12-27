#!/usr/bin/env node

/**
 * Cost Analysis Script for Cloudflare Workers
 * 
 * This script helps estimate cost improvements after optimization changes.
 * It calculates theoretical costs based on typical usage patterns.
 * 
 * Usage: node scripts/analyze-costs.js
 */

// Cloudflare Workers Pricing (as of 2024)
const PRICING = {
    // Free tier: 100k requests/day
    // Paid: $0.50 per million requests
    workerRequests: 0.50 / 1_000_000,

    // CPU time: $12.50 per million GB-s
    cpuTime: 12.50 / 1_000_000,

    // Durable Objects: $0.15 per million requests
    durableObjectRequests: 0.15 / 1_000_000,

    // Queue operations: $0.40 per million operations
    queueOperations: 0.40 / 1_000_000,
};

// Average story processing metrics
const STORY_METRICS = {
    averageScenes: 10,
    imageGenerationTime: 3, // seconds per scene
    audioGenerationTime: 2, // seconds per scene
    workerCpuTime: 0.1, // GB-s per request (128MB worker)
};

/**
 * Calculate costs for OLD configuration (before optimization)
 */
function calculateOldCosts(numStories) {
    const scenesPerStory = STORY_METRICS.averageScenes;
    const totalScenes = numStories * scenesPerStory;

    // OLD: max_batch_size = 1, so each scene = 1 worker invocation
    const imageInvocations = totalScenes;
    const audioInvocations = totalScenes;

    // OLD: Polling finalization - avg 5 polls per story
    const finalizePolls = numStories * 5;

    const totalWorkerInvocations = imageInvocations + audioInvocations + finalizePolls;

    // Queue operations (send + receive)
    const queueOps = totalWorkerInvocations * 2;

    // Durable Object writes (1 per scene for image + audio + finalize checks)
    const durableObjectOps = (imageInvocations + audioInvocations + finalizePolls) * 2;

    // Calculate costs
    const workerCost = totalWorkerInvocations * PRICING.workerRequests;
    const cpuCost = totalWorkerInvocations * STORY_METRICS.workerCpuTime * PRICING.cpuTime;
    const queueCost = queueOps * PRICING.queueOperations;
    const durableObjectCost = durableObjectOps * PRICING.durableObjectRequests;

    return {
        workerInvocations: totalWorkerInvocations,
        queueOperations: queueOps,
        durableObjectOps,
        costs: {
            worker: workerCost,
            cpu: cpuCost,
            queue: queueCost,
            durableObject: durableObjectCost,
            total: workerCost + cpuCost + queueCost + durableObjectCost,
        },
    };
}

/**
 * Calculate costs for NEW configuration (after optimization)
 */
function calculateNewCosts(numStories) {
    const scenesPerStory = STORY_METRICS.averageScenes;
    const totalScenes = numStories * scenesPerStory;

    // NEW: max_batch_size = 10, so ~10 scenes per invocation
    const batchSize = 10;
    const imageInvocations = Math.ceil(totalScenes / batchSize);
    const audioInvocations = Math.ceil(totalScenes / batchSize);

    // NEW: No polling - finalization happens in the last scene's invocation (already counted)
    const finalizePolls = 0;

    const totalWorkerInvocations = imageInvocations + audioInvocations;

    // Queue operations (send for all scenes + receive in batches)
    const queueSendOps = totalScenes * 2; // image + audio
    const queueReceiveOps = totalWorkerInvocations;
    const queueOps = queueSendOps + queueReceiveOps;

    // Durable Object writes (1 per scene for image + audio + 1 finalize per story)
    const durableObjectOps = (totalScenes * 2) + (numStories * 2); // 2x for req+resp

    // Calculate costs
    const workerCost = totalWorkerInvocations * PRICING.workerRequests;
    const cpuCost = totalWorkerInvocations * STORY_METRICS.workerCpuTime * PRICING.cpuTime;
    const queueCost = queueOps * PRICING.queueOperations;
    const durableObjectCost = durableObjectOps * PRICING.durableObjectRequests;

    return {
        workerInvocations: totalWorkerInvocations,
        queueOperations: queueOps,
        durableObjectOps,
        costs: {
            worker: workerCost,
            cpu: cpuCost,
            queue: queueCost,
            durableObject: durableObjectCost,
            total: workerCost + cpuCost + queueCost + durableObjectCost,
        },
    };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return `$${amount.toFixed(4)}`;
}

/**
 * Main analysis
 */
function analyzeImprovements() {
    const scenarios = [
        { stories: 10, label: '10 stories/day' },
        { stories: 100, label: '100 stories/day' },
        { stories: 1000, label: '1,000 stories/day' },
    ];

    console.log('\n=== CLOUDFLARE WORKERS COST ANALYSIS ===\n');
    console.log(`📊 Assumptions:`);
    console.log(`   - Average ${STORY_METRICS.averageScenes} scenes per story`);
    console.log(`   - Worker CPU: ${STORY_METRICS.workerCpuTime} GB-s per request`);
    console.log(`\n`);

    scenarios.forEach(({ stories, label }) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📈 Scenario: ${label}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        const oldCosts = calculateOldCosts(stories);
        const newCosts = calculateNewCosts(stories);

        console.log(`OLD Configuration (before optimization):`);
        console.log(`  Worker Invocations: ${oldCosts.workerInvocations.toLocaleString()}`);
        console.log(`  Queue Operations:   ${oldCosts.queueOperations.toLocaleString()}`);
        console.log(`  Durable Object Ops: ${oldCosts.durableObjectOps.toLocaleString()}`);
        console.log(`  📍 Total Cost: ${formatCurrency(oldCosts.costs.total)}/day\n`);

        console.log(`NEW Configuration (after optimization):`);
        console.log(`  Worker Invocations: ${newCosts.workerInvocations.toLocaleString()}`);
        console.log(`  Queue Operations:   ${newCosts.queueOperations.toLocaleString()}`);
        console.log(`  Durable Object Ops: ${newCosts.durableObjectOps.toLocaleString()}`);
        console.log(`  📍 Total Cost: ${formatCurrency(newCosts.costs.total)}/day\n`);

        const savings = oldCosts.costs.total - newCosts.costs.total;
        const savingsPercent = (savings / oldCosts.costs.total) * 100;
        const monthlySavings = savings * 30;

        console.log(`💰 SAVINGS:`);
        console.log(`  Per Day:   ${formatCurrency(savings)} (${savingsPercent.toFixed(1)}% reduction)`);
        console.log(`  Per Month: ${formatCurrency(monthlySavings)}`);
        console.log(`  Per Year:  ${formatCurrency(monthlySavings * 12)}`);

        console.log(`\n🎯 Key Improvements:`);
        const invocationReduction = ((oldCosts.workerInvocations - newCosts.workerInvocations) / oldCosts.workerInvocations * 100);
        console.log(`  - Worker invocations reduced by ${invocationReduction.toFixed(1)}%`);
        const queueReduction = ((oldCosts.queueOperations - newCosts.queueOperations) / oldCosts.queueOperations * 100);
        console.log(`  - Queue operations reduced by ${queueReduction.toFixed(1)}%`);
        const doReduction = ((oldCosts.durableObjectOps - newCosts.durableObjectOps) / oldCosts.durableObjectOps * 100);
        console.log(`  - Durable Object ops reduced by ${doReduction.toFixed(1)}%`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Analysis complete!\n');
}

// Run analysis
analyzeImprovements();
