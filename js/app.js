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

// Check Auth State
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    } else if (window.location.pathname.includes('dashboard.html')) {
        loadDashboard();
    }
});

// Login Form
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const isAdmin = document.getElementById('isAdmin').checked;

        auth.signInWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                if (isAdmin && userData.role === 'admin') {
                    window.location.href = 'dashboard.html';
                } else if (!isAdmin) {
                    window.location.href = 'profile.html';
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
}

// Logout
if (document.getElementById('logout')) {
    document.getElementById('logout').addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });
}

// Load Dashboard
async function loadDashboard() {
    // Load Members for Contribution and Transaction
    const membersSnapshot = await db.collection('users').get();
    const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Populate Transaction Member Dropdown
    const transactionMember = document.getElementById('transactionMember');
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        transactionMember.appendChild(option);
    });

    // Show/Hide External Name
    transactionMember.addEventListener('change', () => {
        document.getElementById('externalNameDiv').style.display = transactionMember.value === 'external' ? 'block' : 'none';
    });

    // Load Contributions
    const monthSelect = document.getElementById('monthSelect');
    const contributionTable = document.getElementById('contributionTable');
    const editMonthBtn = document.getElementById('editMonth');

    // Populate Contribution Table
    async function loadContributions(month) {
        contributionTable.innerHTML = '';
        for (const member of members) {
            const contributionDoc = await db.collection('contributions').doc(member.id).collection('months').doc(month).get();
            const contribution = contributionDoc.exists ? contributionDoc.data() : { paid: false };
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.name}</td>
                <td><input type="checkbox" class="contribution-check" data-member="${member.id}" ${contribution.paid ? 'checked' : ''} ${editMonthBtn.dataset.editing === 'true' ? '' : 'disabled'}></td>
            `;
            contributionTable.appendChild(row);
        }
    }

    // Load Initial Month
    loadContributions(monthSelect.value);

    // Edit Month
    editMonthBtn.addEventListener('click', () => {
        const isEditing = editMonthBtn.dataset.editing === 'true';
        editMonthBtn.dataset.editing = !isEditing;
        editMonthBtn.textContent = isEditing ? 'Edit Month' : 'Save Month';
        loadContributions(monthSelect.value); // Reload table with updated disabled state
    });

    // Save Contribution
    contributionTable.addEventListener('change', async (e) => {
        if (e.target.classList.contains('contribution-check')) {
            const memberId = e.target.dataset.member;
            const paid = e.target.checked;
            if (!paid) {
                if (confirm('Are you sure you want to remove this payment?')) {
                    await db.collection('contributions').doc(memberId).collection('months').doc(monthSelect.value).set({
                        paid: false,
                        date: null,
                        amount: 0
                    });
                } else {
                    e.target.checked = true; // Revert
                }
            } else {
                await db.collection('contributions').doc(memberId).collection('months').doc(monthSelect.value).set({
                    paid: true,
                    date: new Date().toISOString().split('T')[0],
                    amount: 200
                });
            }
        }
    });

    // Month Change
    monthSelect.addEventListener('change', () => {
        loadContributions(monthSelect.value);
    });

    // Add Member
    document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberData = {
            memberNumber: document.getElementById('memberNumber').value,
            name: document.getElementById('memberName').value,
            homeName: document.getElementById('homeName').value,
            homeNumber: document.getElementById('homeNumber').value,
            familyMembers: parseInt(document.getElementById('familyMembers').value),
            primaryMobile: document.getElementById('primaryMobile').value,
            secondaryMobile: document.getElementById('secondaryMobile').value,
            role: 'member'
        };
        await db.collection('users').add(memberData);
        alert('Member added!');
        document.getElementById('addMemberForm').reset();
        loadDashboard(); // Refresh
    });

    // Add Transaction
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const transactionData = {
            type: document.getElementById('transactionType').value,
            memberId: document.getElementById('transactionMember').value,
            externalName: document.getElementById('externalName').value || null,
            amount: parseInt(document.getElementById('transactionAmount').value),
            head: document.getElementById('transactionHead').value,
            date: document.getElementById('transactionDate').value
        };
        await db.collection('transactions').add(transactionData);
        alert('Transaction added!');
        document.getElementById('transactionForm').reset();
        loadTransactions();
    });

    // Load Transactions
    async function loadTransactions() {
        const transactionTable = document.getElementById('transactionTable');
        transactionTable.innerHTML = '';
        const transactionsSnapshot = await db.collection('transactions').get();
        transactionsSnapshot.forEach(doc => {
            const transaction = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.date}</td>
                <td>${transaction.type}</td>
                <td>${transaction.memberId === 'external' ? transaction.externalName : members.find(m => m.id === transaction.memberId)?.name}</td>
                <td>${transaction.amount}</td>
                <td>${transaction.head}</td>
                <td><button class="btn btn-sm btn-warning edit-transaction" data-id="${doc.id}">Edit</button></td>
            `;
            transactionTable.appendChild(row);
        });
    }
    loadTransactions();
}