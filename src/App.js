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

    async function sttFromMic() {
        if (isListening) {
            recognizer.stopContinuousRecognitionAsync();
            setIsListening(false);
            setDisplayText('Stopped listening.');
            return;
        }

        const tokenObj = await getTokenOrRefresh();
        const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
        speechConfig.speechRecognitionLanguage = 'en-US';
        
        const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
        const newRecognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);

        newRecognizer.recognizing = (s, e) => {
            setCurrentRecognizing(`RECOGNIZING: ${e.result.text}`);
        };

        newRecognizer.recognized = (s, e) => {
            if (e.result.reason === ResultReason.RecognizedSpeech) {
                const newRecognition = `RECOGNIZED: ${e.result.text}`;
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
            setDisplayText(prevText => `${prevText}\nSession stopped event.`);
            newRecognizer.stopContinuousRecognitionAsync();
            setIsListening(false);
        };        

        setRecognizer(newRecognizer);
        setDisplayText('Listening... Speak into your microphone.');
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

    async function fileChange(event) {
        const audioFile = event.target.files[0];
        console.log(audioFile);
        const fileInfo = audioFile.name + ` size=${audioFile.size} bytes `;

        setDisplayText(fileInfo);

        const tokenObj = await getTokenOrRefresh();
        const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
        speechConfig.speechRecognitionLanguage = 'en-US';

        const audioConfig = speechsdk.AudioConfig.fromWavFileInput(audioFile);
        const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognizeOnceAsync(result => {
            let text;
            if (result.reason === ResultReason.RecognizedSpeech) {
                text = `RECOGNIZED: Text=${result.text}`
            } else {
                text = 'ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.';
            }

            setDisplayText(fileInfo + text);
        });
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
                <h1 className="text-5xl font-extrabold text-center text-gray-900 mb-10">Speech Magic</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <button 
                            onClick={sttFromMic} 
                            className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105`}
                        >
                            <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} text-xl mr-2`}></i>
                            {isListening ? 'Stop Listening' : 'Start Speech to Text'}
                        </button>

                        <div>
                            <label htmlFor="audio-file" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10 cursor-pointer transition duration-150 ease-in-out transform hover:scale-105">
                                <i className="fas fa-file-audio text-xl mr-2"></i>
                                Speech to Text (File)
                            </label>
                            <input 
                                type="file" 
                                id="audio-file" 
                                onChange={fileChange} 
                                className="hidden" 
                            />
                        </div>
                        <button onClick={textToSpeech} className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105">
                            <i className="fas fa-volume-up text-xl mr-2"></i>
                            Text to Speech
                        </button>
                        <button 
                            onClick={handleMute} 
                            disabled={!player.p}
                            className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white ${player.p ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'} md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out transform hover:scale-105`}
                        >
                            <i className="fas fa-volume-mute text-xl mr-2"></i>
                            Pause/Resume Audio
                        </button>
                    </div>
                    <div className="bg-gray-800 text-gray-300 p-6 rounded-lg h-96 overflow-auto shadow-inner flex flex-col-reverse">
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