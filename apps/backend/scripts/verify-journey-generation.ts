
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { LifeJourneyGenerator } from '../src/services/incremental-journey.service';
import { env } from '../src/config/env';

/**
 * Verification Script for Life Journey Generation
 * Simulates Teacher Input and verifies AI generation.
 */

async function main() {
    console.log('--- Starting Life Journey Verification ---');
    console.log(`Chat Model: ${env.VOLCENGINE_CHAT_MODEL}`);

    let teacherId: number | null = null;
    let sessionId: number | null = null;

    try {
        // 1. Setup Data
        console.log('\n[Setup] Cleaning old data...');
        const oldTeacher = await prisma.teacher.findUnique({ where: { username: 'test_tech_journey' } });
        if (oldTeacher) {
            await prisma.session.deleteMany({ where: { teacherId: oldTeacher.teacherId } });
            await prisma.teacher.delete({ where: { teacherId: oldTeacher.teacherId } });
        }

        console.log('[Setup] Creating test session...');
        const teacher = await prisma.teacher.create({
            data: { username: `test_tech_journey`, passwordHash: 'hash' }
        });
        teacherId = teacher.teacherId;

        const session = await prisma.session.create({
            data: {
                teacherId: teacher.teacherId,
                sessionName: 'LiBaiJourneyTest',
                authorName: '李白',
                literatureTitle: 'General',
                sessionPin: '888888',
                centralUserId: 99999,
                isActive: true
            }
        });
        sessionId = session.sessionId;

        // 2. Prepare Teacher Input
        // We provide the first stage manual usage.
        const teacherInput = [
            {
                startYear: '701',
                endYear: '705',
                ancientName: '碎叶城 (Suiye)',
                modernName: '吉尔吉斯斯坦托克马克',
                events: '李白出生于此，度过幼年。',
                geography: '西域风情',
                poems: ''
            }
        ];

        console.log('[Step 1] Starting Generation with Teacher Input...');
        console.log('Input:', JSON.stringify(teacherInput, null, 2));

        const generationId = await LifeJourneyGenerator.startGeneration(sessionId, teacherInput);
        console.log(`Generation ID: ${generationId}`);

        // 3. Monitor Progress
        console.log('[Step 2] Monitoring Progress...');
        let complete = false;
        while (!complete) {
            await new Promise(r => setTimeout(r, 2000));
            const progress = await LifeJourneyGenerator.getProgress(sessionId);

            process.stdout.write(`\rStatus: ${progress.status} | Progress: ${progress.progress}% | Loc: ${progress.currentLocation}/${progress.totalLocations}`);

            if (progress.status === 'completed' || progress.status === 'failed') {
                console.log('\nFinal Status:', progress.status);
                if (progress.status === 'failed') {
                    console.error('Error:', progress.errorMessage);
                }
                complete = true;
            }
        }

        // 4. Verify Result
        console.log('\n[Step 3] Verifying Output...');
        const updatedSession = await prisma.session.findUnique({ where: { sessionId } });
        const journey = updatedSession?.lifeJourney as any;

        if (!journey || !journey.locations) {
            throw new Error('Journey data missing in session');
        }

        console.log(`Generated ${journey.locations.length} locations.`);

        const firstLoc = journey.locations[0];
        console.log('First Location (Should match input):', JSON.stringify(firstLoc, null, 2));

        const isMatch = firstLoc.name.includes('碎叶') && firstLoc.events.some((e: string) => e.includes('出生'));

        if (isMatch) {
            console.log('SUCCESS: Teacher input was preserved/integrated.');
        } else {
            console.error('FAILURE: Teacher input mismatch.');
        }

        // Check supplementation
        if (firstLoc.latitude && firstLoc.description) {
            console.log('SUCCESS: AI Supplemented latitude and description.');
        } else {
            console.error('FAILURE: Missing AI supplementation.');
        }

    } catch (e: any) {
        console.error('Test Failed:', e);
        console.error(e.stack);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Deleting test data...');
        try {
            if (sessionId) await prisma.session.delete({ where: { sessionId } }).catch(() => { });
            if (teacherId) await prisma.teacher.delete({ where: { teacherId: teacherId } }).catch(() => { });
        } catch (err) {
            console.log('Cleanup error:', err);
        }
        await prisma.$disconnect();
    }
}

main();
