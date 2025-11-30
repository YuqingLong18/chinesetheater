import { generateLifeJourney } from './journey.service.js';

// Test JSON extraction with various formats
const testCases = [
    {
        name: 'Direct JSON',
        input: '{"heroName": "李白", "summary": "test", "locations": [{"name": "长安", "latitude": 34.26, "longitude": 108.94, "period": "705-724", "description": "test", "events": ["test"], "geography": {"terrain": "test", "vegetation": "test", "water": "test", "climate": "test"}, "poems": [{"title": "test", "content": "test"}]}]}'
    },
    {
        name: 'Markdown wrapped JSON',
        input: '```json\n{"heroName": "李白", "summary": "test", "locations": [{"name": "长安", "latitude": 34.26, "longitude": 108.94, "period": "705-724", "description": "test", "events": ["test"], "geography": {"terrain": "test", "vegetation": "test", "water": "test", "climate": "test"}, "poems": [{"title": "test", "content": "test"}]}]}\n```'
    },
    {
        name: 'JSON with trailing text',
        input: 'Here is the journey:\n{"heroName": "李白", "summary": "test", "locations": [{"name": "长安", "latitude": 34.26, "longitude": 108.94, "period": "705-724", "description": "test", "events": ["test"], "geography": {"terrain": "test", "vegetation": "test", "water": "test", "climate": "test"}, "poems": [{"title": "test", "content": "test"}]}]}\nI hope this helps!'
    },
    {
        name: 'JSON with trailing comma',
        input: '{"heroName": "李白", "summary": "test", "locations": [{"name": "长安", "latitude": 34.26, "longitude": 108.94, "period": "705-724", "description": "test", "events": ["test"], "geography": {"terrain": "test", "vegetation": "test", "water": "test", "climate": "test"}, "poems": [{"title": "test", "content": "test"}],}]}'
    }
];

console.log('Testing JSON extraction strategies...\n');

testCases.forEach(({ name, input }) => {
    console.log(`Test: ${name}`);
    console.log(`Input length: ${input.length} chars`);

    // Test the extraction logic
    const tryParseJson = (text: string): unknown | null => {
        try {
            return JSON.parse(text);
        } catch (error) {
            return null;
        }
    };

    const extractJsonCandidate = (text: string): unknown | null => {
        const strategies = [
            () => JSON.parse(text.trim()),
            () => {
                const match = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
                return match ? JSON.parse(match[1]) : null;
            },
            () => {
                const first = text.indexOf('{');
                const last = text.lastIndexOf('}');
                return (first !== -1 && last > first) ? JSON.parse(text.slice(first, last + 1)) : null;
            },
            () => {
                const fixed = text
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/\/\/.*/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                return JSON.parse(fixed);
            },
            () => {
                const match = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
                if (!match) return null;
                const fixed = match[1]
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/\/\/.*/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                return JSON.parse(fixed);
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const result = strategies[i]();
                if (result) {
                    console.log(`  ✅ Succeeded with strategy ${i + 1}`);
                    return result;
                }
            } catch (error) {
                // Continue
            }
        }

        return null;
    };

    const result = extractJsonCandidate(input);
    if (result) {
        console.log(`  Result: Parsed successfully`);
    } else {
        console.log(`  ❌ Failed to parse`);
    }
    console.log('');
});

console.log('All tests completed!');
