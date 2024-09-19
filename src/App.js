import React, { useState } from 'react';
import { getTokenOrRefresh } from './token_util';
import { ResultReason } from 'microsoft-cognitiveservices-speech-sdk';

const speechsdk = require('microsoft-cognitiveservices-speech-sdk')

export default function App() { 
    const [displayText, setDisplayText] = useState('INITIALIZED: ready...');
    const [inputText, setInputText] = useState('');
    const [player, updatePlayer] = useState({p: undefined, muted: false});
    const [recognizer, setRecognizer] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [recognitionHistory, setRecognitionHistory] = useState([]);
    const [currentRecognizing, setCurrentRecognizing] = useState('');
    const [language, setLanguage] = useState('en-US');

    const toggleLanguage = () => {
        setLanguage(prevLang => prevLang === 'en-US' ? 'mr-IN' : 'en-US');
    };

    async function sttFromMic() {
        if (isListening) {
            recognizer.stopContinuousRecognitionAsync();
            setIsListening(false);
            setDisplayText('Stopped listening.');
            return;
        }

        const tokenObj = await getTokenOrRefresh();
        const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
        speechConfig.speechRecognitionLanguage = language;
        
        const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
        const newRecognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);

        newRecognizer.recognizing = (s, e) => {
            setCurrentRecognizing(`... ${e.result.text}`);
        };

        newRecognizer.recognized = (s, e) => {
            if (e.result.reason === ResultReason.RecognizedSpeech) {
                const newRecognition = `> ${e.result.text}`;
                setRecognitionHistory(prevHistory => {
                    const updatedHistory = [newRecognition, ...prevHistory].slice(0, 19);
                    return updatedHistory;
                });
                setCurrentRecognizing('');
            }
        };

        newRecognizer.canceled = (s, e) => {
            setDisplayText(prevText => `${prevText}\nCANCELED: Reason=${e.reason}`);
            if (e.reason === speechsdk.CancellationReason.Error) {
                setDisplayText(prevText => `${prevText}\nERROR: ${e.errorDetails}`);
            }
            newRecognizer.stopContinuousRecognitionAsync();
            setIsListening(false);
        };

        newRecognizer.sessionStopped = (s, e) => {
            newRecognizer.stopContinuousRecognitionAsync();
            setIsListening(false);
        };        

        setRecognizer(newRecognizer);
        setDisplayText(`Listening... Speak into your microphone. (${language === 'en-US' ? 'English' : 'Marathi'})`);
        newRecognizer.startContinuousRecognitionAsync();
        setIsListening(true);
    }

    async function textToSpeech() {
        if (!inputText.trim()) {
            setDisplayText('Please enter some text to speak.');
            return;
        }

        const tokenObj = await getTokenOrRefresh();
        const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
        speechConfig.speechSynthesisLanguage = language;
        const myPlayer = new speechsdk.SpeakerAudioDestination();
        updatePlayer(p => ({...p, p: myPlayer}));
        const audioConfig = speechsdk.AudioConfig.fromSpeakerOutput(myPlayer);

        let synthesizer = new speechsdk.SpeechSynthesizer(speechConfig, audioConfig);

        setDisplayText(`Speaking text: ${inputText}...`);
        synthesizer.speakTextAsync(
            inputText,
            result => {
                let text;
                if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
                    text = `Synthesis finished for: "${inputText}".\n`
                } else if (result.reason === speechsdk.ResultReason.Canceled) {
                    text = `Synthesis failed. Error detail: ${result.errorDetails}.\n`
                }
                synthesizer.close();
                synthesizer = undefined;
                setDisplayText(text);
            },
            function (err) {
                setDisplayText(`Error: ${err}.\n`);
                synthesizer.close();
                synthesizer = undefined;
            });
    }

    async function handleMute() {
        updatePlayer(p => {
            if (p.p) {
                const newMuted = !p.muted;
                if (newMuted) {
                    p.p.pause();
                } else {
                    p.p.resume();
                }
                return { ...p, muted: newMuted };
            }
            return p;
        });
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
                <h1 className="text-5xl font-extrabold text-center text-gray-900 mb-10">Speech Magic</h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isListening ? 'text-green-600' : 'text-red-600'}`}>
                                {isListening ? `Listening (${language === 'en-US' ? 'English' : 'Marathi'})` : 'Not Listening'}
                            </span>
                            <span className={`h-3 w-3 rounded-full ${isListening ? 'bg-green-600' : 'bg-red-600'}`}></span>
                        </div>
                        <button 
                            onClick={sttFromMic} 
                            className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105`}
                        >
                            <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} text-xl mr-2`}></i>
                            {isListening ? 'Stop Listening' : 'Start Speech to Text'}
                        </button>
                        <button 
                            onClick={toggleLanguage}
                            className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105"
                        >
                            <i className="fas fa-language text-xl mr-2"></i>
                            Switch to {language === 'en-US' ? 'Marathi' : 'English'}
                        </button>
                        <div className="space-y-2 mt-6">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Enter text to speak..."
                                className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none"
                                rows="4"
                            />
                            <button 
                                onClick={textToSpeech} 
                                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105"
                            >
                                <i className="fas fa-volume-up text-xl mr-2"></i>
                                Text to Speech
                            </button>
                        </div>
                        <button 
                            onClick={handleMute} 
                            disabled={!player.p}
                            className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white ${player.p ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'} md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105`}
                        >
                            <i className="fas fa-volume-mute text-xl mr-2"></i>
                            Pause/Resume Audio
                        </button>
                    </div>
                    <div className="bg-gray-800 text-gray-300 p-6 rounded-lg h-[calc(100vh-12rem)] overflow-auto shadow-inner flex flex-col-reverse">
                        {currentRecognizing && (
                            <pre className="text-lg font-open-sans-regular whitespace-pre-wrap mb-2 text-yellow-300">{currentRecognizing}</pre>
                        )}
                        {recognitionHistory.map((recognition, index) => (
                            <pre key={index} className="text-lg font-open-sans-regular whitespace-pre-wrap mb-2">{recognition}</pre>
                        ))}
                        <pre className="text-lg font-open-sans-regular whitespace-pre-wrap mb-4">{displayText}</pre>
                    </div>
                </div>
            </div>
        </div>
    );
}