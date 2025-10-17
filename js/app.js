// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBWswawf9tpxNwVU0BaJ6FCwCvgcjUQXlA",
    authDomain: "shipyard-nagar.firebaseapp.com",
    projectId: "shipyard-nagar",
    storageBucket: "shipyard-nagar.firebasestorage.app",
    messagingSenderId: "552855824221",
    appId: "1:552855824221:web:f709da953077475be9eab4",
    measurementId: "G-V8CQ4YCCQ5"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Login Form
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isAdmin = document.getElementById('isAdmin').checked;

    auth.signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            // Check if user is admin
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            if (isAdmin && userData.role === 'admin') {
                window.location.href = 'dashboard.html'; // Admin dashboard
            } else if (!isAdmin) {
                window.location.href = 'profile.html'; // User profile
            } else {
                alert('Admin access denied!');
                auth.signOut();
            }
        })
        .catch((error) => {
            alert('Error: ' + error.message);
        });
});

// Forgot Password
document.getElementById('forgotPassword').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    if (email) {
        auth.sendPasswordResetEmail(email)
            .then(() => alert('Password reset email sent!'))
            .catch((error) => alert('Error: ' + error.message));
    } else {
        alert('Please enter your email first!');
    }
});

// Remember Me (Optional: Store in localStorage)
document.getElementById('rememberMe').addEventListener('change', (e) => {
    if (e.target.checked) {
        localStorage.setItem('email', document.getElementById('email').value);
    } else {
        localStorage.removeItem('email');
    }
});