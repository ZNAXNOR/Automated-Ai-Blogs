import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js';

const firebaseConfig = await fetch('/__/firebase/init.json');
initializeApp(await firebaseConfig.json());

async function runOrchestrator() {
  const orchestratorFlow = httpsCallable(getFunctions(), 'orchestratorFlow');
  const topic = document.querySelector('#topic').value;
  const resultEl = document.querySelector('#result');
  resultEl.innerText = 'Running...';

  try {
    const response = await orchestratorFlow({ topic });
    const result = response.data;
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
document.querySelector('#runOrchestratorBtn').addEventListener('click', runOrchestrator);

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
