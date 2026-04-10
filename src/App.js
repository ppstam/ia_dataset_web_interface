import './App.css';
import {useState} from 'react';
import Home from './Components/HomeScreen';
import TestScreen from './Components/TestScreen';

function App() {
  const [homeClear, setHomeClear] = useState(false);
  const [data, setData] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [homeInfo, setHomeInfo] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [participantName, setParticipantName] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleParticipantSubmit = (name) => {
    setConfigError(null);
    setLoading(true);
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => { throw new Error(data.error || 'Registration failed'); });
        }
        return response.json();
      })
      .then(data => {
        setData(data.config);
        setQuestions(data.config.questions);
        setHomeInfo(data.config.homeInfo);
        setParticipantId(data.participantId);
        setParticipantName(data.participantName);
        setLoading(false);
      })
      .catch(error => {
        console.error(error);
        setConfigError(error.message);
        setLoading(false);
      });
  };

  // Step 1: participant hasn't registered yet
  if (!data) {
    return (
      <div className="App flex items-center content-center justify-center pt-8">
        <Home
          setHomeClear={setHomeClear}
          homeInfo={null}
          onParticipantSubmit={handleParticipantSubmit}
          configError={configError}
          loading={loading}
        />
      </div>
    );
  }

  // Step 2: registered, show home info or test
  return (
    <div className="App flex items-center content-center justify-center pt-8">
      {homeClear
        ? <TestScreen questions={questions} participantId={participantId} participantName={participantName} />
        : <Home setHomeClear={setHomeClear} homeInfo={homeInfo} />
      }
    </div>
  );
}

export default App;
