// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD8QTm05Aa3u2HBHkZkdrVzRmSa1bUW2Lc",
  authDomain: "blogwebsite-2004.firebaseapp.com",
  projectId: "blogwebsite-2004",
  storageBucket: "blogwebsite-2004.firebasestorage.app",
  messagingSenderId: "523954013072",
  appId: "1:523954013072:web:de0ad7263dd0514b77e915",
  measurementId: "G-M7DFK436P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);