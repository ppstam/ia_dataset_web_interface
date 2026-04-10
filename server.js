const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const CONFIGS_DIR = path.join(__dirname, 'public', 'configs');
const RESULTS_DIR = path.join(__dirname, 'results');
const STATE_FILE = path.join(__dirname, 'server_state.json');
const BUILD_DIR = path.join(__dirname, 'build');

// Ensure directories exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
}

// --- State management ---
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    return {
        participantCount: 0,
        participants: []
        // Each entry: { id, name, configFile, assignedAt, completedAt, status }
    };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Get available config files ---
function getConfigFiles() {
    if (!fs.existsSync(CONFIGS_DIR)) return [];
    return fs.readdirSync(CONFIGS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort();
}

// --- API Routes ---

// Get list of existing participant names (for returning participants)
app.get('/api/participants', (req, res) => {
    const state = loadState();
    const names = state.participants.map(p => ({ name: p.name, status: p.status }));
    res.json({ participants: names });
});

// Register a new participant and assign a config
app.post('/api/register', (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim().toLowerCase();
    const configs = getConfigFiles();
    if (configs.length === 0) {
        return res.status(500).json({ error: 'No config files found in public/configs/' });
    }

    const state = loadState();

    // Check if this participant already exists (by name, case-insensitive)
    const existing = state.participants.find(p => p.name.toLowerCase() === trimmedName);

    if (existing) {
        // Returning participant — give them the same config as before
        const configPath = path.join(CONFIGS_DIR, existing.configFile);
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        console.log(`[Participant #${existing.id}] "${existing.name}" returning — same config: ${existing.configFile} (status: ${existing.status})`);

        return res.json({
            participantId: existing.id,
            participantName: existing.name,
            configFile: existing.configFile,
            config: configData,
            returning: true
        });
    }

    // New participant — check if there are configs left
    const participantNumber = state.participants.length + 1;

    if (participantNumber > configs.length) {
        console.log(`[REJECTED] "${name}" — all ${configs.length} configs are already assigned`);
        return res.status(403).json({
            error: `All available test configurations are currently assigned (${configs.length}/${configs.length}). Please contact the test administrator to add more configurations.`
        });
    }

    const configIndex = participantNumber - 1;
    const configFile = configs[configIndex];

    // Read the assigned config
    const configPath = path.join(CONFIGS_DIR, configFile);
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const participant = {
        id: participantNumber,
        name: name.trim(),
        configFile: configFile,
        assignedAt: new Date().toISOString(),
        completedAt: null,
        status: 'in_progress'
    };

    state.participants.push(participant);
    saveState(state);

    console.log(`[Participant #${participantNumber}] "${name}" NEW — assigned config: ${configFile}`);

    res.json({
        participantId: participantNumber,
        participantName: name.trim(),
        configFile: configFile,
        config: configData,
        returning: false
    });
});

// Save results
app.post('/api/results', (req, res) => {
    const { participantId, participantName, results } = req.body;

    if (!participantId || !results) {
        return res.status(400).json({ error: 'participantId and results are required' });
    }

    // Build CSV content
    const header = 'QuestionId;QuestionAnswers;AnchorAnswers;ReferenceAnswers';
    const rows = results.map(questionResults => {
        const anchorKeys = Object.keys(questionResults.answers).filter(key => key.includes('anchor'));
        const referenceKeys = Object.keys(questionResults.answers).filter(key => key.includes('reference'));
        const anchorValues = anchorKeys.map(key => questionResults.answers[key]).filter(v => v).join(',');
        const referenceValues = referenceKeys.map(key => questionResults.answers[key]).filter(v => v).join(',');

        // Get numeric-indexed answers only
        const numericAnswers = [];
        for (let i = 0; i < Object.keys(questionResults.answers).length; i++) {
            if (questionResults.answers[i] !== undefined) {
                numericAnswers.push(questionResults.answers[i]);
            } else {
                break;
            }
        }

        return `${questionResults.questionId};${numericAnswers.join(',')};${anchorValues || 'null'};${referenceValues || 'null'}`;
    });

    const csvContent = header + '\n' + rows.join('\n');

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (participantName || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `participant_${participantId}_${safeName}_${timestamp}.csv`;
    const filepath = path.join(RESULTS_DIR, filename);

    fs.writeFileSync(filepath, csvContent);

    // Update state
    const state = loadState();
    const participant = state.participants.find(p => p.id === participantId);
    if (participant) {
        participant.completedAt = new Date().toISOString();
        participant.status = 'completed';
        saveState(state);
    }

    console.log(`[Participant #${participantId}] Results saved to ${filename}`);

    res.json({ success: true, filename });
});

// Get status (for you to check progress)
app.get('/api/status', (req, res) => {
    const state = loadState();
    const configs = getConfigFiles();

    const configUsage = {};
    configs.forEach(c => { configUsage[c] = 0; });
    state.participants.forEach(p => {
        configUsage[p.configFile] = (configUsage[p.configFile] || 0) + 1;
    });

    res.json({
        totalParticipants: state.participantCount,
        completed: state.participants.filter(p => p.status === 'completed').length,
        inProgress: state.participants.filter(p => p.status === 'in_progress').length,
        configUsage,
        participants: state.participants
    });
});

// --- Serve React frontend (production build) ---
if (fs.existsSync(BUILD_DIR)) {
    app.use(express.static(BUILD_DIR));

    // Any non-API route serves the React app (client-side routing support)
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(BUILD_DIR, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    const configs = getConfigFiles();
    const hasBuild = fs.existsSync(BUILD_DIR);
    console.log(`\n========================================`);
    console.log(`  Audio Test Server`);
    console.log(`========================================`);
    console.log(`  Running on: http://0.0.0.0:${PORT}`);
    console.log(`  Mode: ${hasBuild ? 'PRODUCTION (serving build/)' : 'API ONLY (use npm start for frontend)'}`);
    console.log(`  Configs found: ${configs.length}`);
    configs.forEach(c => console.log(`    - ${c}`));
    console.log(`  Results saved to: ${RESULTS_DIR}`);
    console.log(`  Status page: http://localhost:${PORT}/api/status`);
    console.log(`========================================\n`);
});