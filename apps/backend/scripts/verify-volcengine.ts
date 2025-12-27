
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as chatService from '../src/services/chat.service';
import * as imageService from '../src/services/image.service';
import * as workshopAiService from '../src/services/workshopAi.service';
import * as spacetimeService from '../src/services/spacetime.service';
import * as incrementalJourneyService from '../src/services/incremental-journey.service';
import { workshopService } from '../src/services/workshop.service';
import { env } from '../src/config/env';

/**
 * Verification Script for Volcengine Migration
 * Tests all AI-related services on the student side.
 */

async function main() {
    console.log('--- Starting Volcengine Verification ---');
    console.log(`Chat Model: ${env.VOLCENGINE_CHAT_MODEL}`);
    console.log(`Image Model: ${env.VOLCENGINE_IMAGE_MODEL}`);
    console.log(`Moderation Model: ${env.VOLCENGINE_MODERATION_MODEL}`);

    let teacherId: number | null = null;
    let sessionId: number | null = null;
    let studentId: number | null = null;

    try {
        // 1. Setup Data
        console.log('\n[Setup] Cleaning old data...');
        const oldTeacher = await prisma.teacher.findUnique({ where: { username: 'test_tech_volc' } });
        if (oldTeacher) {
            // Clean up old session first
            await prisma.session.deleteMany({ where: { teacherId: oldTeacher.teacherId } });
            await prisma.teacher.delete({ where: { teacherId: oldTeacher.teacherId } });
        }

        console.log('[Setup] Creating test session...');
        const teacher = await prisma.teacher.create({
            data: { username: `test_tech_volc`, passwordHash: 'hash' }
        });
        teacherId = teacher.teacherId;

        const session = await prisma.session.create({
            data: {
                teacherId: teacher.teacherId, // using deprecated field for linking just in case
                sessionName: 'VolcengineTest',
                authorName: '李白',
                literatureTitle: '静夜思',
                sessionPin: '999999',
                centralUserId: 12345, // Dummy ID
                isActive: true
            }
        });
        sessionId = session.sessionId;

        const student = await prisma.student.create({
            data: {
                sessionId: session.sessionId,
                username: `test_stu_${Date.now()}`,
                isUsed: true
            }
        });
        studentId = student.studentId;
        console.log(`[Setup] Created Student ID: ${studentId}`);

        // 3. Test Chat Service
        console.log('\n[Test 1] Chat Service (sendStudentMessage)...');
        try {
            // Automatically creates conversation
            const response = await chatService.sendStudentMessage(studentId!, sessionId!, '你好，请用一句话介绍李白。');
            const aiMsg = response.messages.find((m: any) => m.senderType === 'ai');
            console.log('Chat Response:', aiMsg?.content?.slice(0, 50) + '...');
        } catch (e: any) {
            console.error('Chat Service Failed:', e.message);
        }

        // 4. Test Image Generation
        console.log('\n[Test 2] Image Service (generateImage)...');
        let imageId: number | null = null;
        try {
            const image = await imageService.generateImage(
                studentId!,
                sessionId!,
                '水墨画',
                '一只在月光下的白色兔子'
            );
            console.log('Image Generated:', image.imageUrl);
            imageId = image.imageId;
        } catch (e: any) {
            console.error('Image Generation Failed:', e.message);
        }

        // 5. Test Image Editing (if Image Gen succeeded)
        if (imageId) {
            console.log('\n[Test 3] Image Editing (editGeneratedImage)...');
            try {
                // Note: This relies on the model supporting vision or handling the request gracefully
                // If text-only model is used, this might fail or return weird text.
                const edited = await imageService.editGeneratedImage(
                    studentId!,
                    imageId,
                    '把兔子变成红色'
                );
                console.log('Image Edited:', edited.updatedImage.imageUrl);
            } catch (e: any) {
                console.error('Image Editing Failed (Expected if model is text-only):', e.message);
            }
        }

        // 6. Test Workshop AI
        console.log('\n[Test 4] Workshop AI (evaluateRelayContribution)...');
        try {
            // Create a room and contribution
            // Note: createRoom returns room with members
            const room = await workshopService.createRoom({
                creatorType: 'student',
                creatorId: studentId!,
                title: 'TestRoom',
                mode: 'relay',
                theme: 'Moon',
                maxParticipants: 5,
                targetLines: 5,
                meterRequirement: 'None'
            });

            const member = room.members.find(m => m.studentId === studentId);
            if (!member) throw new Error('Creator member not found in room');

            const contribution = await workshopService.submitContribution({
                roomId: room.roomId,
                memberId: member.memberId,
                content: '床前明月光'
            });

            // Trigger Evaluation
            await workshopAiService.evaluateRelayContribution(room.roomId, contribution.contributionId);

            // Check feedback
            await new Promise(r => setTimeout(r, 2000));

            const updatedContrib = await prisma.workshopContribution.findUnique({
                where: { contributionId: contribution.contributionId }
            });

            const hasFeedback = updatedContrib?.aiFeedback && Object.keys(updatedContrib.aiFeedback as object).length > 0;
            console.log('Workshop Feedback:', hasFeedback ? 'Received' : 'None');
            if (hasFeedback) {
                console.log('Feedback Preview:', JSON.stringify(updatedContrib?.aiFeedback).slice(0, 100));
            }

        } catch (e: any) {
            console.error('Workshop AI Failed:', e.message);
            console.error(e.stack);
        }

        // 7. Test Spacetime Analysis
        console.log('\n[Test 5] Spacetime Analysis...');
        try {
            const analysis = await spacetimeService.createSpacetimeAnalysis(studentId!, sessionId!, {
                author: '李白',
                workTitle: '静夜思',
                era: '唐朝',
                genre: '诗歌',
                analysisType: 'sameEra'
            });
            console.log('Analysis Content:', analysis.generatedContent.slice(0, 50) + '...');
        } catch (e: any) {
            console.error('Spacetime Analysis Failed:', e.message);
        }

        // 8. Test Moderation Rejection
        console.log('\n[Test 6] Moderation Rejection...');
        try {
            await chatService.sendStudentMessage(studentId!, sessionId!, 'I want to kill everyone and hurt myself.');
            console.error('FAIL: Moderation should have blocked this message.');
        } catch (e: any) {
            if (e.message.includes('不当内容') || e.message.includes('sensitive') || e.message.includes('violation') || e.message.includes('拦截')) {
                console.log('SUCCESS: Moderation blocked unsafe content.');
            } else {
                console.log('Moderation check result:', e.message);
            }
        }

    } catch (e: any) {
        console.error('Test Setup Failed:', e);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Deleting test data...');
        try {
            if (studentId) await prisma.student.delete({ where: { studentId } }).catch(() => { });
            if (sessionId) await prisma.session.delete({ where: { sessionId } }).catch(() => { });
            if (teacherId) await prisma.teacher.delete({ where: { teacherId: teacherId } }).catch(() => { });
        } catch (err) {
            console.log('Cleanup error (ignorable):', err);
        }
        await prisma.$disconnect();
    }
}

main();
