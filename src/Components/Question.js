import { useEffect, useState } from 'react';
import { Button } from '@material-tailwind/react';
import AudioTestBlock from './AudioTestBlock';
import ScaleBlock from './ScaleBlock';
import { getRandomIndexes, shuffle, shuffleArrayByIndexes } from '../utils/general';

export default function Question({ question, questionIndex, testResults, setTestResults }) {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [submitEnabled, setSubmitEnabled] = useState(false);
    const [audioTestBlocks, setAudioTestBlocks] = useState([]);
    const [randomIndexes, setRandomIndexes] = useState([]);

    // Detect shared audio mode: all testSignals point to the same file
    const uniqueSignals = [...new Set(question.testSignals.filter(s =>
        typeof s === 'string' && (s.endsWith('.mp3') || s.endsWith('.wav') || s.endsWith('.ogg') || s.endsWith('.aac'))
    ))];
    const isSharedAudio = uniqueSignals.length === 1 && question.testSignals.length > 1;

    useEffect(() => {
        // Reset selectedOptions when question changes
        setRandomIndexes(getRandomIndexes(question.testSignals.map((signal, index) => index)))
        let newSelectedOptions = [];
        if (question.shuffleTestSignals){
            newSelectedOptions = shuffleArrayByIndexes(Array(question.testSignals.length).fill(""), randomIndexes);
        }
        else {
            newSelectedOptions = Array(question.testSignals.length).fill("");
        }
        question.references?.forEach((reference, referenceIndex) => {
            newSelectedOptions['reference' + referenceIndex] = "";
        }
        )
        question.anchors?.forEach((anchor, anchorIndex) => {
            newSelectedOptions['anchor' + anchorIndex] = "";
        }
        )
        setSelectedOptions(newSelectedOptions);
    }, [question]);

    useEffect(() => {
        // Check if all audio signals are tested
        let allAudioTested = selectedOptions.length === question.testSignals.length && selectedOptions.every(option => option !== "");
        if (question.anchors && question.anchorEvaluated){
            const anchorsEvaluated = question.anchors.map((anchor, anchorIndex) => {
                return selectedOptions['anchor' + anchorIndex]
            }).every(option => option && option !== "")
            allAudioTested = allAudioTested && anchorsEvaluated
        }
        if (question.references && question.referenceEvaluated){
            const referencesEvaluated = question.references.map((reference, referenceIndex) => {
                return selectedOptions['reference' + referenceIndex]
            }).every(option => option && option !== "")
            allAudioTested = allAudioTested && referencesEvaluated
        }
        
        setSubmitEnabled(allAudioTested);
    }, [selectedOptions, question.testSignals]);

    useEffect(() => {
        // Skip building audioTestBlocks in shared audio mode — we render directly
        if (isSharedAudio) {
            setAudioTestBlocks([]);
            return;
        }

        let newAudioTestBlocks = [];
        //fill all audio test blocks
        if (question.references?.length > 0){
            question.references.forEach((reference, referenceIndex) => {
                newAudioTestBlocks.push(
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
        }
        let testSignalsBlocks = []  
        question.testSignals.forEach((audioPath, audioIndex) => {

            testSignalsBlocks.push(
                <AudioTestBlock
                    key={audioIndex} 
                    question={question}
                    audioPath={audioPath}
                    audioIndex={audioIndex}
                    questionIndex={questionIndex}
                    selectedOptions={selectedOptions}
                    handleOptionClick={handleOptionClick}
                />
            );
        });

        if (question.shuffleTestSignals){
            newAudioTestBlocks = newAudioTestBlocks.concat(
                shuffleArrayByIndexes(testSignalsBlocks,randomIndexes)
            );
        } else {
            newAudioTestBlocks = newAudioTestBlocks.concat(testSignalsBlocks);
        }


        if (question.anchors?.length >0){
            question.anchors.forEach((anchor, anchorIndex) => {
                newAudioTestBlocks.push(
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
        }
                              
        setAudioTestBlocks(newAudioTestBlocks);
    }, [question, selectedOptions]);

    const handleOptionClick = (option, audioIndex) => {
        let newSelectedOptions = [...selectedOptions];
        question.references?.forEach((reference, referenceIndex) => {
            newSelectedOptions['reference' + referenceIndex] = selectedOptions['reference' + referenceIndex];
        }
        )
        question.anchors?.forEach((anchor, anchorIndex) => {
            newSelectedOptions['anchor' + anchorIndex] = selectedOptions['anchor' + anchorIndex];
        }
        )
        newSelectedOptions[audioIndex] = option;
        setSelectedOptions(newSelectedOptions);
    };

    const handleAnswer = () => {
        const updatedTestResults = [...testResults];
        updatedTestResults[questionIndex] = {
            answers: selectedOptions,
            questionName: question.name,
            questionId: question.id,
            labels: question.scale.labels,
        };
        setTestResults(updatedTestResults);

        setSelectedOptions(Array(question.testSignals.length).fill(""));
        setAudioTestBlocks([]);
        setSubmitEnabled(false);
    };

    // Shared audio mode: one player on top, multiple questions with scales below
    if (isSharedAudio) {
        return (
            <div>
                <h2 className='font-bold text-lg'>{question.name}</h2>
                <p className="whitespace-pre-line mb-4">{question.description}</p>

                {/* Single audio player */}
                <div className='flex justify-center mb-6'>
                    <audio controls src={uniqueSignals[0]} className="w-full max-w-lg" />
                </div>

                {/* Questions with scales stacked vertically */}
                {question.testSignals.map((_, audioIndex) => (
                    <div key={audioIndex} className='flex flex-col mb-6 p-4 bg-gray-50 rounded-lg'>
                        <h3 className='font-semibold mb-3'>{question.prompts[audioIndex]}</h3>
                        <div className='flex flex-row items-center gap-4'>
                            <ScaleBlock
                                key={audioIndex + '_scale_block_'}
                                question={question}
                                handleOptionSelect={handleOptionClick}
                                audioIndex={audioIndex}
                                questionIndex={questionIndex}
                                selectedOptions={selectedOptions}
                            />
                        </div>
                    </div>
                ))}

                <Button color='blue' onClick={handleAnswer} disabled={!submitEnabled}>{question.submitButtonText}</Button>
            </div>
        );
    }

    // Default mode: separate audio player per test signal
    return (
        <div>
            <h2 className='font-bold text-lg'>{question.name}</h2>
            <p className="whitespace-pre-line">{question.description}</p>
            <ul>
                { audioTestBlocks}
            </ul>
            <Button color='blue' onClick={handleAnswer} disabled={!submitEnabled}>{question.submitButtonText}</Button>
        </div>
    );
}