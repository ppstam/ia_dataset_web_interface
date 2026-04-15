const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const CONFIGS_DIR = path.join(__dirname, 'public', 'configs');
const RESULTS_DIR = path.join(__dirname, 'results');
const BUILD_DIR = path.join(__dirname, 'build');

// Ensure directories exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
}

// --- Google Sheets Setup ---
let sheetsClient = null;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// In-memory participant state (loaded from Sheets on startup)
let participants = [];

async function initGoogleSheets() {
    try {
        const credentialsJson = process.env.GOOGLE_CREDENTIALS;

        if (!credentialsJson || !GOOGLE_SHEET_ID) {
            console.log('[Google Sheets] Missing credentials — Sheets sync disabled');
            return;
        }

        const credentials = JSON.parse(credentialsJson);
        console.log('[Google Sheets] Connecting as:', credentials.client_email);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.client_email,
                private_key: credentials.private_key,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const authClient = await auth.getClient();
        sheetsClient = google.sheets({ version: 'v4', auth: authClient });

        // Ensure "Results" sheet exists with headers
        await ensureSheet('Results', ['Timestamp', 'ParticipantId', 'ParticipantName', 'ConfigFile', 'QuestionId', 'QuestionName', 'TestAnswers', 'AnchorAnswers', 'ReferenceAnswers']);

        // Ensure "Participants" sheet exists with headers
        await ensureSheet('Participants', ['Id', 'Name', 'ConfigFile', 'AssignedAt', 'CompletedAt', 'Status']);

        // Load participant state from Sheets
        await loadParticipantsFromSheets();

        console.log(`[Google Sheets] Connected successfully — ${participants.length} participants loaded`);
    } catch (error) {
        console.error('[Google Sheets] Failed to connect:', error.message);
        sheetsClient = null;
    }
}

async function ensureSheet(title, headers) {
    if (!sheetsClient) return;

    try {
        // Check if sheet tab exists
        const spreadsheet = await sheetsClient.spreadsheets.get({
            spreadsheetId: GOOGLE_SHEET_ID,
        });

        const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === title);

        if (!existingSheet) {
            // Create the tab
            await sheetsClient.spreadsheets.batchUpdate({
                spreadsheetId: GOOGLE_SHEET_ID,
                requestBody: {
                    requests: [{ addSheet: { properties: { title } } }]
                }
            });
            // Add headers
            await sheetsClient.spreadsheets.values.append({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: `${title}!A1`,
                valueInputOption: 'RAW',
                requestBody: { values: [headers] }
            });
            console.log(`[Google Sheets] Created "${title}" sheet`);
        } else {
            // Check if headers exist
            const response = await sheetsClient.spreadsheets.values.get({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: `${title}!A1:A1`,
            });
            if (!response.data.values || response.data.values.length === 0) {
                await sheetsClient.spreadsheets.values.append({
                    spreadsheetId: GOOGLE_SHEET_ID,
                    range: `${title}!A1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] }
                });
            }
        }
    } catch (error) {
        console.error(`[Google Sheets] Error ensuring "${title}" sheet:`, error.message);
    }
}

async function loadParticipantsFromSheets() {
    if (!sheetsClient) return;

    try {
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: 'Participants!A2:F',
        });

        const rows = response.data.values || [];
        participants = rows.map(row => ({
            id: parseInt(row[0]),
            name: row[1],
            configFile: row[2],
            assignedAt: row[3],
            completedAt: row[4] || null,
            status: row[5] || 'in_progress'
        }));
    } catch (error) {
        console.error('[Google Sheets] Failed to load participants:', error.message);
        participants = [];
    }
}

async function appendParticipantToSheet(participant) {
    if (!sheetsClient) return;

    try {
        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: 'Participants!A1',
            valueInputOption: 'RAW',
            requestBody: {
                values: [[
                    participant.id,
                    participant.name,
                    participant.configFile,
                    participant.assignedAt,
                    participant.completedAt || '',
                    participant.status
                ]]
            }
        });
    } catch (error) {
        console.error('[Google Sheets] Failed to append participant:', error.message);
    }
}

async function updateParticipantStatusInSheet(participantId, completedAt) {
    if (!sheetsClient) return;

    try {
        // Find the row number (id is in column A, starting at row 2)
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: 'Participants!A2:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => parseInt(row[0]) === participantId);

        if (rowIndex !== -1) {
            const sheetRow = rowIndex + 2; // +2 because row 1 is header, and arrays are 0-indexed
            await sheetsClient.spreadsheets.values.update({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: `Participants!E${sheetRow}:F${sheetRow}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[completedAt, 'completed']]
                }
            });
        }
    } catch (error) {
        console.error('[Google Sheets] Failed to update participant status:', error.message);
    }
}

async function appendResultsToSheet(rows) {
    if (!sheetsClient) return;

    try {
        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: 'Results!A1',
            valueInputOption: 'RAW',
            requestBody: { values: rows }
        });
        console.log(`[Google Sheets] Appended ${rows.length} result rows`);
    } catch (error) {
        console.error('[Google Sheets] Failed to append results:', error.message);
    }
}

// Initialize Google Sheets on startup
initGoogleSheets();

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
    const names = participants.map(p => ({ name: p.name, status: p.status }));
    res.json({ participants: names });
});

// Register a new participant and assign a config
app.post('/api/register', async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim().toLowerCase();
    const configs = getConfigFiles();
    if (configs.length === 0) {
        return res.status(500).json({ error: 'No config files found in public/configs/' });
    }

    // Check if this participant already exists (by name, case-insensitive)
    const existing = participants.find(p => p.name.toLowerCase() === trimmedName);

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
    const participantNumber = participants.length + 1;

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

    // Save to memory and Google Sheets
    participants.push(participant);
    await appendParticipantToSheet(participant);

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
app.post('/api/results', async (req, res) => {
    const { participantId, participantName, results } = req.body;

    if (!participantId || !results) {
        return res.status(400).json({ error: 'participantId and results are required' });
    }

    // Update participant status in memory
    const participant = participants.find(p => p.id === participantId);
    const configFile = participant ? participant.configFile : 'unknown';
    const completedAt = new Date().toISOString();
    if (participant) {
        participant.completedAt = completedAt;
        participant.status = 'completed';
    }

    // Update status in Google Sheets
    await updateParticipantStatusInSheet(participantId, completedAt);

    // Push results to Google Sheets
    const sheetRows = results.map(questionResults => {
        const anchorKeys = Object.keys(questionResults.answers).filter(key => key.includes('anchor'));
        const referenceKeys = Object.keys(questionResults.answers).filter(key => key.includes('reference'));
        const anchorValues = anchorKeys.map(key => questionResults.answers[key]).filter(v => v).join(',');
        const referenceValues = referenceKeys.map(key => questionResults.answers[key]).filter(v => v).join(',');

        const numericAnswers = [];
        for (let i = 0; i < Object.keys(questionResults.answers).length; i++) {
            if (questionResults.answers[i] !== undefined) {
                numericAnswers.push(questionResults.answers[i]);
            } else {
                break;
            }
        }

        return [
            completedAt,
            participantId,
            participantName || 'unknown',
            configFile,
            questionResults.questionId,
            questionResults.questionName || '',
            numericAnswers.join(','),
            anchorValues || 'null',
            referenceValues || 'null'
        ];
    });

    await appendResultsToSheet(sheetRows);

    console.log(`[Participant #${participantId}] Results saved to Google Sheets`);

    res.json({ success: true });
});

// Get status (for you to check progress)
app.get('/api/status', (req, res) => {
    const configs = getConfigFiles();

    const configUsage = {};
    configs.forEach(c => { configUsage[c] = 0; });
    participants.forEach(p => {
        configUsage[p.configFile] = (configUsage[p.configFile] || 0) + 1;
    });

    res.json({
        totalParticipants: participants.length,
        completed: participants.filter(p => p.status === 'completed').length,
        inProgress: participants.filter(p => p.status === 'in_progress').length,
        configUsage,
        participants: participants
    });
});

// --- Serve React frontend (production build) ---
if (fs.existsSync(BUILD_DIR)) {
    app.use(express.static(BUILD_DIR));

    // Any non-API route serves the React app (client-side routing support)
    app.use((req, res, next) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api')) {
            return next();
        }
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
    console.log(`  Status page: http://localhost:${PORT}/api/status`);
    console.log(`========================================\n`);
});