# Audio Subjective Tests — Web Interface

A web-based interface for running subjective audio listening tests (e.g. MUSHRA, MOS) with per-participant configuration, automatic config assignment, server-side result collection, and participant tracking.

## Features

- **Config-driven tests**: define questions, audio files, scales, anchors, and references in JSON files — no code changes needed.
- **Multiple scale types**: continuous sliders, discrete radio buttons, and dropdown menus.
- **Automatic config assignment**: each new participant is assigned the next available config sequentially (participant 1 → `config1.json`, participant 2 → `config2.json`, etc.).
- **Sticky assignment**: if a participant returns and enters the same name, they get the exact same config as before.
- **Capacity enforcement**: when all configs are assigned, new participants are shown a message and cannot proceed — no config is reused unintentionally.
- **Returning participant menu**: participants who forget their name can select it from a dropdown of existing participants.
- **Server-side result storage**: answers are saved as CSV files on the host machine — no reliance on client-side downloads.
- **Live monitoring**: a status API endpoint shows participant count, completion status, and config usage in real time.
- **Shuffling support**: test signals can be randomized per question to reduce ordering bias.
- **LAN/VPN accessible**: designed to be served on a local network so multiple participants can take the test from different machines.

## Prerequisites

- [Conda](https://docs.conda.io/en/latest/) (Miniconda or Anaconda)
- Or any system with Node.js 18+

## Installation

### 1. Create a conda environment

```bash
conda create -n audio-tests nodejs -c conda-forge
conda activate audio-tests
```

### 2. Clone the repository

```bash
git clone https://github.com/pedrohlopes/web-audio-subjective-tests.git
cd web-audio-subjective-tests
```

### 3. Install dependencies

```bash
npm install
npm install express
```

## Configuration

### Creating test configs

Create a `configs/` folder inside `public/` and add one JSON file per participant:

```
public/
  configs/
    config1.json
    config2.json
    config3.json
    ...
```

Each config file follows the same format as the original `subjective_test_config.json`. Here is a minimal example:

```json
{
    "homeInfo": {
        "title": "Audio Quality Test",
        "message": "You will listen to several audio samples and rate their quality.\nPlease use headphones.",
        "buttonText": "Start test"
    },
    "questions": [
        {
            "name": "Question 1",
            "description": "Rate the quality of each audio sample.",
            "id": 1,
            "anchors": ["test_signals/anchor.wav"],
            "references": ["test_signals/reference.wav"],
            "testSignals": ["test_signals/test1.wav", "test_signals/test2.wav"],
            "prompts": {
                "0": "Sample A",
                "1": "Sample B",
                "anchor0": "Low anchor",
                "reference0": "Reference"
            },
            "scale": {
                "type": "continuous",
                "alignment": "horizontal",
                "labels": ["Bad", "Poor", "Fair", "Good", "Excellent"],
                "values": [0, 20, 40, 60, 80, 100],
                "range": [0, 100]
            },
            "shuffleTestSignals": true,
            "referenceEvaluated": false,
            "anchorEvaluated": true,
            "submitButtonText": "Submit"
        }
    ]
}
```

Each config can have different questions, audio files, scale types, or orderings — useful for counterbalancing across participants.

### Scale types

- **`continuous`**: a slider with configurable range and border labels. Requires `range`, `values`, and optionally `borderLabels`.
- **`discrete`**: radio buttons. Requires `labels` and `values`.
- **`dropdown`**: a dropdown menu. Requires `labels` and `values`.

### Audio files

Place your audio files (`.wav`, `.mp3`, `.ogg`, `.aac`) in `public/test_signals/` or any subfolder under `public/`. Reference them in the config with paths relative to `public/`, e.g. `"test_signals/my_audio.wav"`.

## Running

You need **two terminals**, both with the conda environment activated.

### Terminal 1 — Backend server

```bash
conda activate audio-tests
node server.js
```

You should see:

```
========================================
  Audio Test Backend Server
========================================
  Running on: http://0.0.0.0:3001
  Configs found: 3
    - config1.json
    - config2.json
    - config3.json
  Results saved to: /path/to/web-audio-subjective-tests/results
  Status page: http://localhost:3001/api/status
========================================
```

### Terminal 2 — Frontend

```bash
conda activate audio-tests
HOST=0.0.0.0 npm start
```

The app will be available at `http://localhost:3000`.

## Network Access (LAN / VPN)

To let other machines on your network access the test:

1. Find your IP address:
   ```bash
   ip addr
   ```
   Look for the IP on your relevant interface (e.g. `tun0` for VPN, `eth0` for LAN).

2. Make sure port 3000 is not blocked by a firewall:
   ```bash
   sudo ufw allow 3000
   ```

3. Share the URL with participants:
   ```
   http://<your-ip>:3000
   ```

### Optional: custom hostname

Ask your network admin to create a DNS entry pointing to your IP, or have participants add an entry to their `/etc/hosts` file:

```
<your-ip>    audiotest.local
```

Then the URL becomes `http://audiotest.local:3000`.

## How It Works

### Participant flow

1. Participant opens the app and enters their name.
2. The backend assigns them the next available config (sequentially).
3. If all configs are taken, the participant sees an error and cannot proceed.
4. If the participant has been here before (same name, case-insensitive), they get their original config again.
5. Returning participants who forgot their name can pick it from a dropdown.
6. The participant completes the test.
7. Results are saved as a CSV file on the server in the `results/` folder.

### Config assignment

Configs are assigned **sequentially** based on the alphabetical order of filenames in `public/configs/`:

| Participant # | Config assigned |
|---|---|
| 1 | config1.json |
| 2 | config2.json |
| 3 | config3.json |
| 4 | *(rejected — no configs left)* |

To add capacity, simply add more config files and restart the backend.

### Results

Results are saved in the `results/` directory at the project root as CSV files named:

```
participant_1_Alice_2026-04-10T14-30-00-000Z.csv
participant_2_Bob_2026-04-10T15-12-00-000Z.csv
```

CSV format (`;` delimited):

```
QuestionId;QuestionAnswers;AnchorAnswers;ReferenceAnswers
```

## Monitoring

### Status endpoint

Visit `http://localhost:3001/api/status` to see a JSON summary:

```json
{
  "totalParticipants": 5,
  "completed": 3,
  "inProgress": 2,
  "configUsage": {
    "config1.json": 1,
    "config2.json": 1,
    "config3.json": 1
  },
  "participants": [
    {
      "id": 1,
      "name": "Alice",
      "configFile": "config1.json",
      "assignedAt": "2026-04-10T14:30:00.000Z",
      "completedAt": "2026-04-10T14:45:00.000Z",
      "status": "completed"
    }
  ]
}
```

### Server logs

The backend terminal logs every registration and submission in real time:

```
[Participant #1] "Alice" NEW — assigned config: config1.json
[Participant #1] Results saved to participant_1_Alice_2026-04-10T14-30-00-000Z.csv
[Participant #2] "Bob" NEW — assigned config: config2.json
[Participant #1] "Alice" returning — same config: config1.json (status: completed)
[REJECTED] "Charlie" — all 2 configs are already assigned
```

## Resetting

To start a fresh experiment, delete the state file and results:

```bash
rm server_state.json
rm -rf results/
```

Then restart the backend.

## Project Structure

```
web-audio-subjective-tests/
├── server.js                    # Backend API server
├── server_state.json            # Auto-generated participant state (do not edit while running)
├── package.json
├── results/                     # Auto-generated CSV results folder
│   ├── participant_1_Alice_....csv
│   └── ...
├── public/
│   ├── configs/                 # One JSON config per participant
│   │   ├── config1.json
│   │   ├── config2.json
│   │   └── ...
│   ├── test_signals/            # Audio files
│   │   ├── anchor.wav
│   │   ├── reference.wav
│   │   └── test.wav
│   └── index.html
├── src/
│   ├── App.js                   # Main app — routes between home and test screens
│   ├── Components/
│   │   ├── HomeScreen.js        # Name entry + returning participant dropdown
│   │   ├── TestScreen.js        # Test runner + result submission
│   │   ├── Question.js          # Single question with audio blocks
│   │   ├── AudioTestBlock.js    # Audio player + scale for one sample
│   │   └── ScaleBlock.js        # Renders continuous/discrete/dropdown scales
│   └── utils/
│       ├── general.js           # Shuffle utilities
│       └── writeCSV.js          # (Legacy — no longer used, results go to server)
└── tailwind.config.js
```

## Troubleshooting

**"JSON.parse: unexpected character"** when clicking Start — The backend is not running or the proxy isn't working. Make sure `node server.js` is running in a separate terminal and that you restarted `npm start` after adding the `"proxy"` field to `package.json`.

**"No config files found"** — Create the `public/configs/` directory and add at least one `.json` config file.

**Participants on other machines can't connect** — Check that you used `HOST=0.0.0.0 npm start` (not just `npm start`), that port 3000 isn't firewalled, and that the machines are on the same network/VPN.

**Want to add more participants mid-experiment** — Add more config files to `public/configs/` and restart the backend. Existing assignments are preserved in `server_state.json`.
