import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';
import type { LifeJourneyEntryInput } from './journey.service.js';
import type { Session } from '@prisma/client';

const LOCATION_TIMEOUT_MS = 120_000; // 2 minutes per location
const LOCATION_MAX_RETRIES = 3;
const LOCATION_RETRY_DELAY_MS = 2_000;

interface GenerateLocationOptions {
    session: Session;
    orderIndex: number;
    teacherEntry?: LifeJourneyEntryInput;
    previousLocations: Array<{
        name: string;
        period: string;
    }>;
    attemptNumber: number;
}

export class LifeJourneyGenerator {
    private generationId: number;
    private sessionId: number;

    constructor(generationId: number, sessionId: number) {
        this.generationId = generationId;
        this.sessionId = sessionId;
    }

    /**
     * Start a new generation job
     */
    static async startGeneration(
        sessionId: number,
        teacherEntries?: LifeJourneyEntryInput[]
    ): Promise<number> {
        const session = await prisma.session.findUnique({
            where: { sessionId }
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Determine total locations needed
        const validEntries = (teacherEntries || []).filter(entry =>
            !!(
                entry.startYear ||
                entry.endYear ||
                (entry.ancientName && entry.ancientName.trim()) ||
                (entry.modernName && entry.modernName.trim()) ||
                (entry.events && entry.events.trim()) ||
                (entry.geography && entry.geography.trim()) ||
                (entry.poems && entry.poems.trim())
            )
        );
        const totalLocations = Math.max(6, validEntries.length);

        // Create generation record
        const generation = await prisma.lifeJourneyGeneration.create({
            data: {
                sessionId,
                status: 'in_progress',
                progress: 0,
                currentLocation: 0,
                totalLocations,
                model: env.OPENROUTER_CHAT_MODEL,
                teacherEntries: validEntries.length > 0 ? validEntries : null
            }
        });

        // Create pending location records
        for (let i = 0; i < totalLocations; i++) {
            await prisma.lifeJourneyLocation.create({
                data: {
                    generationId: generation.generationId,
                    orderIndex: i,
                    status: 'pending'
                }
            });
        }

        // Start async generation
        const generator = new LifeJourneyGenerator(generation.generationId, sessionId);
        generator.generateIncrementally().catch(error => {
            console.error(`Generation failed for generationId=${generation.generationId}:`, error);
        });

        return generation.generationId;
    }

    /**
     * Generate locations incrementally
     */
    private async generateIncrementally(): Promise<void> {
        try {
            const generation = await prisma.lifeJourneyGeneration.findUnique({
                where: { generationId: this.generationId },
                include: {
                    session: true,
                    locations: {
                        orderBy: { orderIndex: 'asc' }
                    }
                }
            });

            if (!generation) {
                throw new Error('Generation not found');
            }

            const teacherEntries = (generation.teacherEntries as LifeJourneyEntryInput[]) || [];
            const previousLocations: Array<{ name: string; period: string }> = [];

            for (let i = 0; i < generation.totalLocations; i++) {
                try {
                    // Update current location
                    await prisma.lifeJourneyGeneration.update({
                        where: { generationId: this.generationId },
                        data: { currentLocation: i }
                    });

                    // Generate this location
                    await this.generateSingleLocation({
                        session: generation.session,
                        orderIndex: i,
                        teacherEntry: teacherEntries[i],
                        previousLocations,
                        attemptNumber: 0
                    });

                    // Add to previous locations for context
                    const location = await prisma.lifeJourneyLocation.findFirst({
                        where: {
                            generationId: this.generationId,
                            orderIndex: i
                        }
                    });

                    if (location && location.name && location.period) {
                        previousLocations.push({
                            name: location.name,
                            period: location.period
                        });
                    }

                    // Update progress
                    const progress = Math.round(((i + 1) / generation.totalLocations) * 100);
                    await prisma.lifeJourneyGeneration.update({
                        where: { generationId: this.generationId },
                        data: { progress }
                    });
                } catch (error) {
                    console.error(`Failed to generate location ${i}:`, error);
                    // Continue with next location
                }
            }

            // Finalize generation
            await this.finalizeGeneration();
        } catch (error) {
            await prisma.lifeJourneyGeneration.update({
                where: { generationId: this.generationId },
                data: {
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            throw error;
        }
    }

    /**
     * Generate a single location with retries
     */
    private async generateSingleLocation(options: GenerateLocationOptions): Promise<void> {
        const { session, orderIndex, teacherEntry, previousLocations, attemptNumber } = options;

        // Update location status to generating
        await prisma.lifeJourneyLocation.update({
            where: {
                generationId_orderIndex: {
                    generationId: this.generationId,
                    orderIndex
                }
            },
            data: {
                status: 'generating',
                attemptCount: attemptNumber + 1
            }
        });

        try {
            const prompt = this.buildLocationPrompt(
                session,
                orderIndex,
                teacherEntry,
                previousLocations,
                attemptNumber
            );

            const response = await callOpenRouter<{ choices?: Array<{ message?: { content?: string } }> }>(
                '/chat/completions',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        model: env.OPENROUTER_CHAT_MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a data expert. Return ONLY valid JSON, no markdown, no explanations.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ]
                    }),
                    timeoutMs: LOCATION_TIMEOUT_MS,
                    maxRetries: 0 // We handle retries ourselves
                }
            );

            const raw = response.choices?.[0]?.message?.content ?? '';
            const parsed = this.extractJSON(raw);

            if (!parsed) {
                throw new Error('No valid JSON in response');
            }

            // Validate and save
            await this.saveLocation(orderIndex, parsed, raw);
        } catch (error) {
            if (attemptNumber < LOCATION_MAX_RETRIES - 1) {
                // Retry
                await new Promise(resolve => setTimeout(resolve, LOCATION_RETRY_DELAY_MS * (attemptNumber + 1)));
                return this.generateSingleLocation({
                    ...options,
                    attemptNumber: attemptNumber + 1
                });
            } else {
                // Mark as failed
                await prisma.lifeJourneyLocation.update({
                    where: {
                        generationId_orderIndex: {
                            generationId: this.generationId,
                            orderIndex
                        }
                    },
                    data: {
                        status: 'failed',
                        errorMessage: error instanceof Error ? error.message : 'Unknown error'
                    }
                });
                throw error;
            }
        }
    }

    /**
     * Build prompt for a single location
     */
    private buildLocationPrompt(
        session: Session,
        orderIndex: number,
        teacherEntry?: LifeJourneyEntryInput,
        previousLocations: Array<{ name: string; period: string }> = [],
        attemptNumber: number = 0
    ): string {
        let prompt = `Generate location ${orderIndex + 1} for ${session.authorName}'s life journey.

CRITICAL: Return ONLY valid JSON, no markdown code fences, no explanations.

`;

        if (attemptNumber > 0) {
            prompt += `PREVIOUS ATTEMPT FAILED. Ensure:
- Return ONLY JSON (no \`\`\`json markers)
- All required fields present
- Arrays not empty
- Valid coordinates

`;
        }

        if (teacherEntry) {
            prompt += `Teacher guidance (MUST follow):
`;
            if (teacherEntry.startYear || teacherEntry.endYear) {
                const period =
                    teacherEntry.startYear && teacherEntry.endYear
                        ? `${teacherEntry.startYear}-${teacherEntry.endYear}`
                        : teacherEntry.startYear
                            ? `${teacherEntry.startYear}-?`
                            : `?-${teacherEntry.endYear}`;
                prompt += `- Period: ${period}\n`;
            }
            if (teacherEntry.ancientName) prompt += `- Ancient name: ${teacherEntry.ancientName}\n`;
            if (teacherEntry.modernName) prompt += `- Modern name: ${teacherEntry.modernName}\n`;
            if (teacherEntry.events) prompt += `- Events: ${teacherEntry.events}\n`;
            if (teacherEntry.geography) prompt += `- Geography: ${teacherEntry.geography}\n`;
            if (teacherEntry.poems) prompt += `- Poems: ${teacherEntry.poems}\n`;
            prompt += '\n';
        }

        if (previousLocations.length > 0) {
            prompt += `Previously generated locations:
${previousLocations.map(l => `- ${l.name} (${l.period})`).join('\n')}

`;
        }

        prompt += `Return JSON in this EXACT format:
{
  "name": "地点名称",
  "modernName": "现代称谓",
  "latitude": 34.26,
  "longitude": 108.94,
  "period": "起始年-终止年",
  "description": "该阶段概述",
  "events": ["事件1", "事件2"],
  "geography": {
    "terrain": "地形",
    "vegetation": "植被",
    "water": "水域",
    "climate": "气候"
  },
  "poems": [
    {"title": "诗名", "content": "诗句原文"}
  ]
}`;

        return prompt;
    }

    /**
     * Extract JSON from response
     */
    private extractJSON(text: string): unknown | null {
        const strategies = [
            () => JSON.parse(text.trim()),
            () => {
                const match = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
                return match ? JSON.parse(match[1]) : null;
            },
            () => {
                const first = text.indexOf('{');
                const last = text.lastIndexOf('}');
                return first !== -1 && last > first ? JSON.parse(text.slice(first, last + 1)) : null;
            },
            () => {
                const fixed = text
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/\/\/.*/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                return JSON.parse(fixed);
            }
        ];

        for (const strategy of strategies) {
            try {
                const result = strategy();
                if (result) return result;
            } catch { }
        }

        return null;
    }

    /**
     * Save location data
     */
    private async saveLocation(orderIndex: number, data: any, rawResponse: string): Promise<void> {
        await prisma.lifeJourneyLocation.update({
            where: {
                generationId_orderIndex: {
                    generationId: this.generationId,
                    orderIndex
                }
            },
            data: {
                status: 'completed',
                name: data.name || null,
                modernName: data.modernName || null,
                latitude: typeof data.latitude === 'number' ? data.latitude : null,
                longitude: typeof data.longitude === 'number' ? data.longitude : null,
                period: data.period || null,
                description: data.description || null,
                events: data.events || null,
                geography: data.geography || null,
                poems: data.poems || null,
                rawResponse
            }
        });
    }

    /**
     * Finalize generation and update session
     */
    private async finalizeGeneration(): Promise<void> {
        const generation = await prisma.lifeJourneyGeneration.findUnique({
            where: { generationId: this.generationId },
            include: {
                session: true,
                locations: {
                    where: { status: 'completed' },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!generation) {
            throw new Error('Generation not found');
        }

        // Convert to old format
        const journey = {
            heroName: generation.session.authorName,
            summary: `${generation.session.authorName}的人生行迹`,
            locations: generation.locations.map((loc, idx) => ({
                id: idx + 1,
                name: loc.name!,
                modernName: loc.modernName || undefined,
                latitude: loc.latitude!,
                longitude: loc.longitude!,
                period: loc.period!,
                description: loc.description!,
                events: (loc.events as string[]) || [],
                geography: (loc.geography as any) || {},
                poems: (loc.poems as any[]) || []
            })),
            highlights: [],
            routeNotes: null
        };

        // Update session
        await prisma.session.update({
            where: { sessionId: this.sessionId },
            data: {
                lifeJourney: journey,
                lifeJourneyGeneratedAt: new Date()
            }
        });

        // Mark generation complete
        const status = generation.locations.length >= 3 ? 'completed' : 'partial';
        await prisma.lifeJourneyGeneration.update({
            where: { generationId: this.generationId },
            data: {
                status,
                progress: 100,
                completedAt: new Date()
            }
        });
    }

    /**
     * Get current progress
     */
    static async getProgress(sessionId: number) {
        const generation = await prisma.lifeJourneyGeneration.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
            include: {
                locations: {
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!generation) {
            return {
                status: 'none' as const,
                progress: 0,
                currentLocation: null,
                totalLocations: 0,
                locations: []
            };
        }

        return {
            status: generation.status,
            progress: generation.progress,
            currentLocation: generation.currentLocation,
            totalLocations: generation.totalLocations,
            locations: generation.locations.map(loc => ({
                orderIndex: loc.orderIndex,
                status: loc.status,
                name: loc.name,
                errorMessage: loc.errorMessage
            })),
            errorMessage: generation.errorMessage
        };
    }
}
