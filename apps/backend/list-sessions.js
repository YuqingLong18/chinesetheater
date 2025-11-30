#!/usr/bin/env node

const BASE_URL = 'http://localhost:4000/api';
const USERNAME = 'ylong';
const PASSWORD = 'xm8wreWmBr!';

async function login() {
    const response = await fetch(`${BASE_URL}/teacher/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });

    if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
}

async function listSessions(token) {
    const response = await fetch(`${BASE_URL}/teacher/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.status}`);
    }

    const data = await response.json();
    return data.sessions || [];
}

async function main() {
    console.log('Logging in...');
    const token = await login();
    console.log('✅ Logged in\n');

    console.log('Fetching sessions...');
    const sessions = await listSessions(token);

    console.log(`\nFound ${sessions.length} session(s):\n`);
    sessions.forEach(session => {
        console.log(`  ID: ${session.sessionId}`);
        console.log(`  Name: ${session.sessionName}`);
        console.log(`  Author: ${session.authorName}`);
        console.log(`  Title: ${session.literatureTitle}`);
        console.log(`  PIN: ${session.sessionPin}`);
        console.log(`  Created: ${new Date(session.createdAt).toLocaleString()}`);
        console.log('');
    });

    if (sessions.length > 0) {
        console.log(`\nUse session ID: ${sessions[0].sessionId} for testing`);
    } else {
        console.log('\n⚠️  No sessions found. Create one first.');
    }
}

main().catch(console.error);
