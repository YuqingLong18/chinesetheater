#!/usr/bin/env node

const BASE_URL = 'http://localhost:4000/api';
const TEST_SESSION_ID = 1;
const USERNAME = 'ylong';
const PASSWORD = 'xm8wreWmBr!';

let authToken = null;

async function login() {
    console.log('\n=== Logging in as teacher ===\n');

    try {
        const response = await fetch(`${BASE_URL}/teacher/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: USERNAME,
                password: PASSWORD
            })
        });

        if (!response.ok) {
            console.error(`❌ Login failed: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return false;
        }

        const data = await response.json();
        authToken = data.token;
        console.log('✅ Login successful');
        console.log(`Token: ${authToken.substring(0, 20)}...`);

        return true;
    } catch (error) {
        console.error('❌ Error during login:', error);
        return false;
    }
}

async function testProgressEndpoint() {
    console.log('\n=== Testing Progress Endpoint ===\n');

    try {
        const response = await fetch(`${BASE_URL}/teacher/sessions/${TEST_SESSION_ID}/life-journey/progress`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            console.error(`❌ Progress endpoint failed: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return false;
        }

        const data = await response.json();
        console.log('✅ Progress endpoint response:');
        console.log(JSON.stringify(data, null, 2));

        return true;
    } catch (error) {
        console.error('❌ Error calling progress endpoint:', error);
        return false;
    }
}

async function startGeneration() {
    console.log('\n=== Starting Incremental Generation ===\n');

    try {
        const response = await fetch(`${BASE_URL}/teacher/sessions/${TEST_SESSION_ID}/life-journey`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entries: []
            })
        });

        if (!response.ok) {
            console.error(`❌ Generation start failed: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return false;
        }

        const data = await response.json();
        console.log('✅ Generation started:');
        console.log(JSON.stringify(data, null, 2));

        return true;
    } catch (error) {
        console.error('❌ Error starting generation:', error);
        return false;
    }
}

async function pollProgress(maxAttempts = 60, intervalMs = 3000) {
    console.log('\n=== Polling Progress (updates every 3 seconds) ===\n');

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${BASE_URL}/teacher/sessions/${TEST_SESSION_ID}/life-journey/progress`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                console.error(`❌ Progress poll failed: ${response.status}`);
                continue;
            }

            const data = await response.json();

            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] Status: ${data.status}, Progress: ${data.progress}%, Current: ${data.currentLocation !== null ? data.currentLocation + 1 : 'N/A'}/${data.totalLocations}`);

            if (data.locations && data.locations.length > 0) {
                const locationSummary = data.locations.map(loc => {
                    const statusIcon = loc.status === 'completed' ? '✅' :
                        loc.status === 'generating' ? '🔄' :
                            loc.status === 'failed' ? '❌' : '⏳';
                    return `${statusIcon} ${loc.name || 'Pending'}`;
                }).join(' | ');
                console.log(`  ${locationSummary}`);
            }

            if (data.status === 'completed') {
                console.log('\n✅ Generation completed successfully!');
                return true;
            }

            if (data.status === 'failed') {
                console.log(`\n❌ Generation failed: ${data.errorMessage}`);
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, intervalMs));
        } catch (error) {
            console.error(`❌ Error polling progress:`, error);
        }
    }

    console.log('\n⚠️  Max polling attempts reached');
    return false;
}

async function verifyFinalJourney() {
    console.log('\n=== Verifying Final Journey ===\n');

    try {
        const response = await fetch(`${BASE_URL}/teacher/sessions/${TEST_SESSION_ID}/life-journey`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            console.error(`❌ Journey fetch failed: ${response.status}`);
            return false;
        }

        const data = await response.json();

        if (data.journey) {
            console.log('✅ Final journey saved:');
            console.log(`  Hero: ${data.journey.heroName}`);
            console.log(`  Locations: ${data.journey.locations?.length || 0}`);
            if (data.journey.locations) {
                data.journey.locations.forEach((loc, idx) => {
                    console.log(`    ${idx + 1}. ${loc.name} (${loc.period})`);
                });
            }
            return true;
        } else {
            console.log('⚠️  No journey data found');
            return false;
        }
    } catch (error) {
        console.error('❌ Error verifying journey:', error);
        return false;
    }
}

async function runTests() {
    console.log('='.repeat(70));
    console.log('  Incremental Journey Generation API Test');
    console.log('='.repeat(70));
    console.log(`\nSession ID: ${TEST_SESSION_ID}`);
    console.log(`Username: ${USERNAME}`);
    console.log(`Base URL: ${BASE_URL}`);

    // Step 1: Login
    const loginOk = await login();
    if (!loginOk) {
        console.log('\n❌ Login failed. Stopping.');
        return;
    }

    // Step 2: Check initial progress state
    console.log('\n' + '-'.repeat(70));
    const progressOk = await testProgressEndpoint();
    if (!progressOk) {
        console.log('\n❌ Progress endpoint test failed. Stopping.');
        return;
    }

    // Step 3: Start generation
    console.log('\n' + '-'.repeat(70));
    const startOk = await startGeneration();
    if (!startOk) {
        console.log('\n❌ Generation start failed. Stopping.');
        return;
    }

    // Step 4: Poll progress
    console.log('\n' + '-'.repeat(70));
    const pollOk = await pollProgress();

    // Step 5: Verify final journey
    console.log('\n' + '-'.repeat(70));
    await verifyFinalJourney();

    console.log('\n' + '='.repeat(70));
    console.log(pollOk ? '✅ All tests passed!' : '⚠️  Tests completed with warnings');
    console.log('='.repeat(70) + '\n');
}

runTests().catch(console.error);
