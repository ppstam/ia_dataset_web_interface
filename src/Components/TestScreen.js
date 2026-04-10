import Question from "./Question";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@material-tailwind/react";

export default function TestScreen({questions, participantId, participantName}) {

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [testResults, setTestResults] = useState(Array(questions.length));
    const [testComplete, setTestComplete] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);


    useEffect(() => {
        if (testResults[0]){
            if (currentQuestion < questions.length - 1){
                setCurrentQuestion(currentQuestion+1);
            }
            else{
                setTestComplete(true)
            }
        }

    }, [testResults]);


    useEffect(()=> {
        if (testComplete){
            // Send results to backend
            fetch('/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantId,
                    participantName,
                    results: testResults
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    setSaveStatus('saved');
                } else {
                    setSaveStatus('error');
                }
            })
            .catch(error => {
                console.error('Failed to save results:', error);
                setSaveStatus('error');
            });
        }
        
    }, [testComplete])


    return (
        <Card className="flex justify-center items-center gap-4 p-8 max-w-[80%]">
        {
            testComplete ? (
                <div className="text-center">
                    <h1 className="text-xl font-bold mb-2">Test Complete</h1>
                    {saveStatus === 'saved' && (
                        <p className="text-green-600">Your answers have been saved. Thank you!</p>
                    )}
                    {saveStatus === 'error' && (
                        <p className="text-red-500">There was an error saving your answers. Please contact the test administrator.</p>
                    )}
                    {saveStatus === null && (
                        <p className="text-gray-500">Saving your answers...</p>
                    )}
                </div>
            ) : (
                <>
                    <Question question={questions[currentQuestion]}
                        questionIndex={currentQuestion}
                        setQuestionIndex={setCurrentQuestion}
                        testResults={testResults}
                        setTestResults={setTestResults}
                    />
                </>
            )
        }
        </Card>
    );
}