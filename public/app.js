
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

const firebaseConfig = await fetch('/__/firebase/init.json');
initializeApp(await firebaseConfig.json());

async function runOrchestrator() {
  const topic = document.querySelector('#topic').value;
  const resultEl = document.querySelector('#result');
  resultEl.innerText = 'Running...';

  try {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error('You must be signed in to run this.');
    }
    const idToken = await user.getIdToken();

    const response = await fetch('/orchestrator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: { topic } }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    const result = responseData.result;

    resultEl.innerHTML = `
      <h2>${result.title}</h2>
      <p>${result.content}</p>
      <a href="${result.publishResult.link}" target="_blank">View Post</a>
    `;
  } catch (err) {
    resultEl.innerText = `Error: ${err}`;
  }
}

function signIn() {
  signInWithPopup(getAuth(), new GoogleAuthProvider());
}

document.querySelector('#signinBtn').addEventListener('click', signIn);
document
  .querySelector('#runOrchestratorBtn')
  .addEventListener('click', runOrchestrator);

const signinEl = document.querySelector('#signin');
const genkitEl = document.querySelector('#callGenkit');

onAuthStateChanged(getAuth(), (user) => {
  if (!user) {
    signinEl.hidden = false;
    genkitEl.hidden = true;
  } else {
    signinEl.hidden = true;
    genkitEl.hidden = false;
  }
});
