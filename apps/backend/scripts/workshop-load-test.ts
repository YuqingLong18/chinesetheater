import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let EventSource = require('eventsource');
if (EventSource.EventSource) {
    EventSource = EventSource.EventSource;
}

// Configuration
const BASE_URL = 'http://localhost:4000';
const SESSION_PIN = '9AC4R9'; // User provided
const TOTAL_STUDENTS = 50;
const GROUP_SIZE = 5;
const TEST_DURATION_MS = 60 * 1000; // Run for 1 minute
const ACTION_DELAY_MS = 3000; // Delay between actions

// State
interface Student {
    nickname: string;
    token: string;
    studentId: number;
}
interface Group {
    id: number;
    students: Student[];
    roomId?: number;
}

const students: Student[] = [];
const groups: Group[] = [];
const errors: string[] = [];
let actionCount = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log(`Starting Load Test with ${TOTAL_STUDENTS} students...`);
    console.log(`Target: ${BASE_URL}, PIN: ${SESSION_PIN}`);

    // 1. Create Students / Login
    console.log('--- Phase 1: Student Login ---');
    for (let i = 0; i < TOTAL_STUDENTS; i++) {
        try {
            const nickname = `LoadTest_Student_${i}`;
            // Note: Assuming /api/auth/student/login endpoint based on recent refactor
            // Payload: { code: string, nickname: string }
            const res = await axios.post(`${BASE_URL}/api/student/login`, {
                sessionPin: SESSION_PIN,
                username: nickname
            });
            students.push({
                nickname,
                token: res.data.token,
                studentId: res.data.profile.studentId
            });
            if (i % 10 === 0) process.stdout.write('.');
        } catch (err: any) {
            console.error(`\nFailed to login student ${i}:`, err.message);
            errors.push(`Login failed for ${i}: ${err.message}`);
        }
    }
    console.log(`\nSuccessfully logged in ${students.length} students.`);

    if (students.length === 0) {
        console.error('No students logged in. Aborting.');
        return;
    }

    // 2. Form Groups
    for (let i = 0; i < students.length; i += GROUP_SIZE) {
        groups.push({
            id: groups.length + 1,
            students: students.slice(i, i + GROUP_SIZE)
        });
    }
    console.log(`Formed ${groups.length} groups.`);

    // 3. Workshop Activities (Parallel for Groups)
    console.log('--- Phase 2: Workshop Activities ---');
    const groupPromises = groups.map((group) => simulateGroup(group));

    await Promise.all(groupPromises);

    // 4. Report
    console.log('\n--- Load Test Complete ---');
    console.log(`Total Actions: ${actionCount}`);
    console.log(`Total Errors: ${errors.length}`);
    if (errors.length > 0) {
        console.log('Sample Errors:', errors.slice(0, 5));
    }
}

async function simulateGroup(group: Group) {
    try {
        const creator = group.students[0];
        const others = group.students.slice(1);

        // A. Create Room
        // Endpoint: POST /api/student/workshops
        const createRes = await axios.post(
            `${BASE_URL}/api/student/workshops`,
            {
                title: `LoadTest Room ${group.id}`,
                mode: 'relay',
                maxParticipants: GROUP_SIZE,
                theme: 'Load Testing',
                meterRequirement: 'Free',
                targetLines: 20
            },
            { headers: { Authorization: `Bearer ${creator.token}` } }
        );
        const room = createRes.data.room;
        group.roomId = room.roomId;
        console.log(`[Group ${group.id}] Room created: ${room.code}`);

        // B. Others Join
        // Endpoint: POST /api/student/workshops/join
        for (const student of others) {
            await axios.post(
                `${BASE_URL}/api/student/workshops/join`,
                { code: room.code, nickname: student.nickname },
                { headers: { Authorization: `Bearer ${student.token}` } }
            );
            await sleep(100); // slight stagger
        }
        console.log(`[Group ${group.id}] All members joined.`);

        // C. SSE Connection & Round Robin
        // We will attach SSE for ALL members to simulate real load
        const eventSources: EventSource[] = [];

        // Setup SSE for everyone
        group.students.forEach(student => {
            const url = `${BASE_URL}/api/student/workshops/${group.roomId}/stream?token=${encodeURIComponent(student.token)}`;
            const es = new EventSource(url);
            es.onerror = (err) => {
                // console.error(`[Group ${group.id}] SSE Error for ${student.nickname}`);
            };
            eventSources.push(es);
        });

        // Simulate Turns
        const startTime = Date.now();
        let turnIndex = 0; // Current index in group.students array

        while (Date.now() - startTime < TEST_DURATION_MS) {
            // Who is active? In our simulation, we enforce strict round robin
            // The backend logic is complex, but let's assume if we submit, next turn happens.

            const activeStudent = group.students[turnIndex % group.students.length];

            // Submit Contribution
            try {
                await sleep(Math.random() * 1000 + 1000); // Think time 1-2s response
                await axios.post(
                    `${BASE_URL}/api/student/workshops/${group.roomId}/contributions`,
                    { content: `Line ${Date.now()} by ${activeStudent.nickname}` },
                    { headers: { Authorization: `Bearer ${activeStudent.token}` } }
                );
                actionCount++;
                // Move to next student
                turnIndex++;
            } catch (err: any) {
                // If not my turn, backend throws 400. That's expected if we drift.
                // We'll just wait and retry same student or skip? 
                // To recover, let's just wait a bit.
                // console.log(`[Group ${group.id}] Submit failed: ${err.message}`);
                errors.push(`[Group ${group.id}] Submit failed: ${err.message}`);
                await sleep(1000);
            }
        }

        // Cleanup SSE
        eventSources.forEach(es => es.close());

    } catch (err: any) {
        console.error(`[Group ${group.id}] CRITICAL FAILURE:`, err.message);
        errors.push(`Group ${group.id} Critical: ${err.message}`);
    }
}

main();
