// Firebase config (from project)
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId
};

// Initialize Firebase (compat SDK expected)
if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
  try {
    // Avoid re-initializing if already initialized
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    // Expose commonly used services
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.firestore();
    window.firebaseStorage = firebase.storage();
    console.log('Firebase initialized');
  } catch (e) {
    console.warn('Firebase init error:', e);
  }
} else {
  console.warn('Firebase SDK not loaded. Make sure you included Firebase scripts.');
}