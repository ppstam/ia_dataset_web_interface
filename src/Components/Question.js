import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@material-tailwind/react';
import AudioTestBlock from './AudioTestBlock';
import ScaleBlock from './ScaleBlock';
import { getRandomIndexes, shuffleArrayByIndexes } from '../utils/general';

export default function Question({ question, questionIndex, testResults, setTestResults }) {
    // --- State ---
    const [testAnswers, setTestAnswers] = useState([]);
    const [extraAnswers, setExtraAnswers] = useState({});
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [randomIndexes, setRandomIndexes] = useState([]);

    const isSurvey = question.type === 'survey';

    const uniqueSignals = useMemo(() => {
        if (isSurvey) return [];
        return [...new Set(
            question.testSignals.filter(s =>
                typeof s === 'string' &&
                (s.endsWith('.mp3') || s.endsWith('.wav') || s.endsWith('.ogg') || s.endsWith('.aac'))
            )
        )];
    }, [question, isSurvey]);

    const isSharedAudio = uniqueSignals.length === 1 && !isSurvey && question.testSignals.length > 1;

    useEffect(() => {
        if (isSurvey) {
            const initial = {};
            (question.fields || []).forEach(field => {
                initial[field.id] = '';
            });
            setSurveyAnswers(initial);
            setTestAnswers([]);
            setExtraAnswers({});
            setRandomIndexes([]);
            return;
        }

        const indexes = getRandomIndexes(question.testSignals.map((_, i) => i));
        setRandomIndexes(indexes);

        const initialAnswers = Array(question.testSignals.length).fill("");
        setTestAnswers(initialAnswers);

        const initialExtras = {};
        (question.references || []).forEach((_, i) => { initialExtras['reference' + i] = ""; });
        (question.anchors || []).forEach((_, i) => { initialExtras['anchor' + i] = ""; });
        setExtraAnswers(initialExtras);

        setSurveyAnswers({});
    }, [question, isSurvey]);

    const submitEnabled = useMemo(() => {
        if (isSurvey) {
            if (!question.fields) return false;
            return question.fields
                .filter(f => f.required !== false)
                .every(f => surveyAnswers[f.id] && surveyAnswers[f.id].toString().trim() !== '');
        }

        if (testAnswers.length !== question.testSignals.length) return false;
        if (!testAnswers.every(o => o !== "")) return false;

        if (question.anchors && question.anchorEvaluated) {
            const ok = question.anchors.every((_, i) => extraAnswers['anchor' + i] && extraAnswers['anchor' + i] !== "");
            if (!ok) return false;
        }

        if (question.references && question.referenceEvaluated) {
            const ok = question.references.every((_, i) => extraAnswers['reference' + i] && extraAnswers['reference' + i] !== "");
            if (!ok) return false;
        }

        return true;
    }, [isSurvey, question, testAnswers, extraAnswers, surveyAnswers]);

    const handleOptionClick = useCallback((option, audioIndex) => {
        if (typeof audioIndex === 'number') {
            setTestAnswers(prev => {
                const next = [...prev];
                next[audioIndex] = option;
                return next;
            });
        } else {
            setExtraAnswers(prev => ({ ...prev, [audioIndex]: option }));
        }
    }, []);

    const handleSurveyChange = (fieldId, value) => {
        setSurveyAnswers(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleAnswer = () => {
        const updated = [...testResults];

        if (isSurvey) {
            updated[questionIndex] = {
                answers: surveyAnswers,
                questionName: question.name,
                questionId: question.id,
                labels: Object.keys(surveyAnswers),
            };
        } else {
            const mergedAnswers = [...testAnswers];
            Object.keys(extraAnswers).forEach(k => {
                mergedAnswers[k] = extraAnswers[k];
            });

            updated[questionIndex] = {
                answers: mergedAnswers,
                questionName: question.name,
                questionId: question.id,
                labels: question.scale?.labels,
            };
        }

        setTestResults(updated);
    };

    const selectedOptions = useMemo(() => {
        const combined = [...testAnswers];
        Object.keys(extraAnswers).forEach(k => {
            combined[k] = extraAnswers[k];
        });
        return combined;
    }, [testAnswers, extraAnswers]);

    const audioTestBlocks = useMemo(() => {
        if (isSurvey || isSharedAudio) return [];

        const blocks = [];

        (question.references || []).forEach((reference, referenceIndex) => {
            blocks.push(
                <AudioTestBlock
                    key={'reference' + referenceIndex}
                    question={question}
                    audioPath={reference}
                    audioIndex={'reference' + referenceIndex}
                    questionIndex={questionIndex}
                    selectedOptions={selectedOptions}
                    handleOptionClick={handleOptionClick}
                />
            );
        });

        const testBlocks = question.testSignals.map((audioPath, audioIndex) => (
            <AudioTestBlock
                key={audioIndex}
                question={question}
                audioPath={audioPath}
                audioIndex={audioIndex}
                questionIndex={questionIndex}
                selectedOptions={selectedOptions}
                handleOptionClick={handleOptionClick}
            />
        ));

        if (question.shuffleTestSignals && randomIndexes.length === testBlocks.length) {
            blocks.push(...shuffleArrayByIndexes(testBlocks, randomIndexes));
        } else {
            blocks.push(...testBlocks);
        }

        (question.anchors || []).forEach((anchor, anchorIndex) => {
            blocks.push(
                <AudioTestBlock
                    key={'anchor' + anchorIndex}
                    question={question}
                    audioPath={anchor}
                    audioIndex={'anchor' + anchorIndex}
                    questionIndex={questionIndex}
                    selectedOptions={selectedOptions}
                    handleOptionClick={handleOptionClick}
                />
            );
        });

        return blocks;
    }, [isSurvey, isSharedAudio, question, questionIndex, selectedOptions, handleOptionClick, randomIndexes]);

    // Helper to render a prompt (handles both string and array)
    const renderPrompt = (prompt) => {
        const text = Array.isArray(prompt) ? prompt.join('') : prompt;
        return <p className='font-semibold mb-3 whitespace-pre-line'>{text}</p>;
    };

    // --- Render: Survey ---
    if (isSurvey) {
        return (
            <div>
                <h2 className='font-bold text-lg'>{question.name}</h2>
                <p className="whitespace-pre-line mb-6">{question.description}</p>

                {question.fields.map((field) => (
                    <div key={field.id} className='flex flex-col mb-6 p-4 bg-gray-50 rounded-lg'>
                        <label className='font-semibold mb-2'>
                            {field.label}
                            {field.required !== false && <span className="text-red-500 ml-1">*</span>}
                        </label>

                        {field.type === 'number' && (
                            <input
                                type="number"
                                min={field.min !== undefined ? field.min : 0}
                                max={field.max !== undefined ? field.max : undefined}
                                value={surveyAnswers[field.id] || ''}
                                onChange={(e) => handleSurveyChange(field.id, e.target.value)}
                                placeholder={field.placeholder || ''}
                                className="border border-gray-300 rounded px-3 py-2 w-48"
                            />
                        )}

                        {field.type === 'text' && (
                            <input
                                type="text"
                                value={surveyAnswers[field.id] || ''}
                                onChange={(e) => handleSurveyChange(field.id, e.target.value)}
                                placeholder={field.placeholder || ''}
                                className="border border-gray-300 rounded px-3 py-2 w-full"
                            />
                        )}

                        {field.type === 'textarea' && (
                            <textarea
                                value={surveyAnswers[field.id] || ''}
                                onChange={(e) => handleSurveyChange(field.id, e.target.value)}
                                placeholder={field.placeholder || ''}
                                rows={field.rows || 4}
                                className="border border-gray-300 rounded px-3 py-2 w-full resize-y"
                            />
                        )}

                        {field.type === 'select' && (
                            <select
                                value={surveyAnswers[field.id] || ''}
                                onChange={(e) => handleSurveyChange(field.id, e.target.value)}
                                className="border border-gray-300 rounded px-3 py-2 w-full max-w-sm bg-white"
                            >
                                <option value="">— Select —</option>
                                {(field.options || []).map((opt, oi) => (
                                    <option key={oi} value={opt}>{opt}</option>
                                ))}
                            </select>
                        )}
                    </div>
                ))}

                <Button color='blue' onClick={handleAnswer} disabled={!submitEnabled}>
                    {question.submitButtonText}
                </Button>
            </div>
        );
    }

    // --- Render: Shared Audio ---
    if (isSharedAudio) {
        return (
            <div>
                <h2 className='font-bold text-lg'>{question.name}</h2>
                <p className="whitespace-pre-line mb-4">{question.description}</p>

                {question.caption && (
                    <p className="italic text-xl text-center mb-4 px-4">"{question.caption}"</p>
                )}

                <div className='flex justify-center mb-6'>
                    <audio controls src={uniqueSignals[0]} className="w-full max-w-lg" />
                </div>

                {question.testSignals.map((_, audioIndex) => {
                    const signalScale = question.scales ? question.scales[audioIndex] : question.scale;
                    return (
                        <div key={audioIndex} className='flex flex-col mb-6 p-4 bg-gray-50 rounded-lg'>
                            {renderPrompt(question.prompts[audioIndex])}
                            <div className='flex flex-row items-center gap-4'>
                                <ScaleBlock
                                    key={audioIndex + '_scale_block_'}
                                    question={question}
                                    scale={signalScale}
                                    handleOptionSelect={handleOptionClick}
                                    audioIndex={audioIndex}
                                    questionIndex={questionIndex}
                                    selectedOptions={selectedOptions}
                                />
                            </div>
                        </div>
                    );
                })}

                <Button color='blue' onClick={handleAnswer} disabled={!submitEnabled}>
                    {question.submitButtonText}
                </Button>
            </div>
        );
    }

    // --- Render: Default ---
    return (
        <div>
            <h2 className='font-bold text-lg'>{question.name}</h2>
            <p className="whitespace-pre-line">{question.description}</p>
            {question.caption && (
                <p className="italic text-xl text-center mb-4 px-4">"{question.caption}"</p>
            )}
            <ul>{audioTestBlocks}</ul>
            <Button color='blue' onClick={handleAnswer} disabled={!submitEnabled}>
                {question.submitButtonText}
            </Button>
        </div>
    );
}