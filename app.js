const startRecordingButton = document.getElementById('startRecording');
const userMessagesDiv = document.getElementById('userMessages');
const aiMessagesDiv = document.getElementById('aiMessages');

let mediaRecorder;
let audioChunks = [];

let audioContext;
let mediaStreamSource;
let scriptProcessorNode;
let silenceStart;
const silenceDuration = 2; // in seconds
const whisperEndpoint = 'http://localhost:3001/proxy/asr?task=transcribe&output=json';
const authKey = 'VF.DM.669105e2d4c5dd4ff9cab0b1.u3H3Rr2XHrHaM20F';
const versionID = "6690d6f00b546ef70f5073f1";

let USER_ID;

async function fetchUserId() {
    const response = await fetch('http://localhost:3001/user-id');
    const data = await response.json();
    USER_ID = data.USER_ID;
}

async function init() {
  await fetchUserId();

  try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext = new AudioContext();
      mediaStreamSource = audioContext.createMediaStreamSource(stream);
      scriptProcessorNode = audioContext.createScriptProcessor(4096, 1, 1);

      scriptProcessorNode.onaudioprocess = function (event) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          checkForSilence(inputBuffer);
      };

      mediaStreamSource.connect(scriptProcessorNode);
      scriptProcessorNode.connect(audioContext.destination);

      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener('dataavailable', (event) => {
          audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
          audioChunks = [];

          const { text } = await sendToWhisperAPI(audioBlob);
          addChatBubble(text, 'userBubble', userMessagesDiv);
          await sendTextToVoiceflow(text);
      });

      startRecordingButton.addEventListener('click', () => {
          if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              startRecordingButton.textContent = 'Start Recording';
          } else {
              mediaRecorder.start();
              silenceStart = Date.now();
              startRecordingButton.textContent = 'Stop Recording';
          }
      });
  } catch (err) {
      console.error('Error initializing media recorder:', err);
      alert('Failed to get access to the microphone.');
  }
}

function checkForSilence(inputBuffer) {
  const isSilent = isBufferSilent(inputBuffer);
  if (isSilent) {
      if (Date.now() - silenceStart > silenceDuration * 1000) {
          if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              startRecordingButton.textContent = 'Start Recording';
          }
      }
  } else {
      silenceStart = Date.now();
  }
}

function isBufferSilent(buffer) {
  const threshold = 0.02;
  for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > threshold) {
          return false;
      }
  }
  return true;
}

async function sendToWhisperAPI(audioBlob) {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, 'audio.mp3');
  formData.append('language', 'hi'); 

  const response = await fetch(whisperEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  if (response.ok) {
    const data = await response.json();
    return { text: data.text };
  } else {
    console.error('Error sending audio to Whisper API:', response);
    alert('Failed to send audio to Whisper API.');
    return { text: 'Error: Failed to convert speech to text.' };
  }
}

async function sendTextToVoiceflow(text) {
  const projectId = "6690d6f00b546ef70f5073f1";
  const url = `https://general-runtime.voiceflow.com/state/user/${USER_ID}/interact`;
  const voiceflowEndpoint = url;
  const data = {
    action: {
      type: "text",
      payload: text,
    },
  };

  const response = await fetch(voiceflowEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authKey,
    },
    body: JSON.stringify(data),
  });

  if (response.ok) {
    const responseData = await response.json();
    const botMessage = responseData[1]?.payload?.message || "No response from bot.";
    addChatBubble(botMessage, 'botBubble', aiMessagesDiv);
  } else {
    console.error("Error sending text to Voiceflow:", response);
    addChatBubble("Error: Failed to send text to Voiceflow.", 'botBubble', aiMessagesDiv);
  }
}

function addChatBubble(text, className, containerDiv) {
  const chatBubble = document.createElement('div');
  chatBubble.className = `chatBubble ${className} p-2 rounded-lg max-w-xs break-words mb-2`;
  chatBubble.textContent = text;
  containerDiv.appendChild(chatBubble);
}

init();
