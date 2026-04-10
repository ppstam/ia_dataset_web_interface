import React, { useState, useEffect } from 'react';
import { Button, Card } from "@material-tailwind/react";
import { Select, Option } from "@material-tailwind/react";

function Home({ setHomeClear, homeInfo, onParticipantSubmit, configError, loading }) {
    const [inputName, setInputName] = useState('');
    const [existingParticipants, setExistingParticipants] = useState([]);
    const [selectedExisting, setSelectedExisting] = useState('');
    const [isReturning, setIsReturning] = useState(false);

    useEffect(() => {
        if (!homeInfo) {
            fetch('/api/participants')
                .then(res => res.json())
                .then(data => setExistingParticipants(data.participants || []))
                .catch(err => console.error('Failed to load participants:', err));
        }
    }, [homeInfo]);

    // If no homeInfo yet, show the participant entry screen
    if (!homeInfo) {
        return (
            <Card className="flex justify-center items-center content-center self-center text-start gap-4 p-8 max-w-[100%]">
                <h1 className='text-lg font-bold'>Welcome</h1>

                {!isReturning ? (
                    <>
                        <p>Please enter your name to begin:</p>
                        <input
                            type="text"
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && inputName.trim() && !loading) {
                                    onParticipantSubmit(inputName.trim());
                                }
                            }}
                            placeholder="Your name"
                            className="border border-gray-300 rounded px-3 py-2 w-64 text-center"
                            disabled={loading}
                        />
                        {configError && (
                            <p className="text-red-500 text-sm">{configError}</p>
                        )}
                        <Button
                            onClick={() => {
                                if (inputName.trim()) onParticipantSubmit(inputName.trim());
                            }}
                            color='blue'
                            disabled={!inputName.trim() || loading}
                        >
                            {loading ? 'Loading...' : 'Start'}
                        </Button>
                        {existingParticipants.length > 0 && (
                            <button
                                onClick={() => setIsReturning(true)}
                                className="text-sm text-blue-500 underline mt-2"
                            >
                                Already done this before? Select your name
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <p>Select your name from the list:</p>
                        <div className="w-64">
                            <Select
                                label="Select your name"
                                value={selectedExisting}
                                onChange={(val) => setSelectedExisting(val)}
                            >
                                {existingParticipants.map((p, i) => (
                                    <Option key={i} value={p.name}>
                                        {p.name} {p.status === 'completed' ? '(completed)' : '(in progress)'}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                        {configError && (
                            <p className="text-red-500 text-sm">{configError}</p>
                        )}
                        <Button
                            onClick={() => {
                                if (selectedExisting) onParticipantSubmit(selectedExisting);
                            }}
                            color='blue'
                            disabled={!selectedExisting || loading}
                        >
                            {loading ? 'Loading...' : 'Continue test'}
                        </Button>
                        <button
                            onClick={() => setIsReturning(false)}
                            className="text-sm text-blue-500 underline mt-2"
                        >
                            I'm a new participant
                        </button>
                    </>
                )}
            </Card>
        );
    }

    // Once config is loaded, show the normal home screen
    return (
        <Card className="flex justify-center items-center content-center self-center text-start gap-4 p-8 max-w-[100%]">
            <h1 className='text-lg font-bold'>{homeInfo.title}</h1>
            <p className="whitespace-pre-line">{homeInfo.message}</p>
            <Button onClick={() => { setHomeClear(true) }} color='blue'>{homeInfo.buttonText}</Button>
        </Card>
    );
}

export default Home;