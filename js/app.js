// Check if firebase is defined
if (typeof firebase === 'undefined') {
    alert('Error: Firebase SDK not loaded. Check network or script tags.');
} else {
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
    try {
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Set Auth Persistence to local
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                // Member Login
                if (document.getElementById('memberLoginForm')) {
                    document.getElementById('memberLoginForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const email = document.getElementById('memberEmail').value;
                        const password = document.getElementById('memberPassword').value;

                        auth.signInWithEmailAndPassword(email, password)
                            .then((userCredential) => {
                                alert('Member login successful! Redirecting to profile...');
                                window.location.href = 'profile.html';
                            })
                            .catch((error) => {
                                alert('Member Login Error: ' + error.message);
                            });
                    });

                    document.getElementById('memberForgotPassword').addEventListener('click', () => {
                        const email = document.getElementById('memberEmail').value;
                        if (email) {
                            auth.sendPasswordResetEmail(email)
                                .then(() => alert('Password reset email sent!'))
                                .catch((error) => alert('Forgot Password Error: ' + error.message));
                        } else {
                            alert('Please enter your email first!');
                        }
                    });

                    document.getElementById('memberRememberMe').addEventListener('change', (e) => {
                        if (e.target.checked) {
                            localStorage.setItem('email', document.getElementById('memberEmail').value);
                        } else {
                            localStorage.removeItem('email');
                        }
                    });
                }

                // Admin Login
                if (document.getElementById('adminLoginForm')) {
                    document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const email = document.getElementById('adminEmail').value;
                        const password = document.getElementById('adminPassword').value;

                        auth.signInWithEmailAndPassword(email, password)
                            .then(async (userCredential) => {
                                const user = userCredential.user;
                                try {
                                    const userDoc = await db.collection('users').doc(user.uid).get();
                                    if (!userDoc.exists) {
                                        alert('Error: User document not found in Firestore.');
                                        setTimeout(() => window.location.href = 'profile.html', 2000);
                                    } else if (userDoc.data().role !== 'admin') {
                                        alert(`Error: User role is "${userDoc.data().role || 'undefined'}", not "admin".`);
                                        setTimeout(() => window.location.href = 'profile.html', 2000);
                                    } else {
                                        alert('Admin login successful! Redirecting to dashboard...');
                                        window.location.href = 'dashboard.html';
                                    }
                                } catch (error) {
                                    alert('Admin Login Error: ' + error.message);
                                }
                            })
                            .catch((error) => {
                                alert('Admin Login Error: ' + error.message);
                            });
                    });

                    document.getElementById('adminForgotPassword').addEventListener('click', () => {
                        const email = document.getElementById('adminEmail').value;
                        if (email) {
                            auth.sendPasswordResetEmail(email)
                                .then(() => alert('Password reset email sent!'))
                                .catch((error) => alert('Forgot Password Error: ' + error.message));
                        } else {
                            alert('Please enter your email first!');
                        }
                    });
                }

                // Logout
                if (document.getElementById('logout')) {
                    document.getElementById('logout').addEventListener('click', () => {
                        auth.signOut().then(() => {
                            alert('Logged out successfully!');
                            window.location.href = 'login.html';
                        });
                    });
                }

                // Load Dashboard (Admin)
                async function loadDashboard() {
                    if (!document.getElementById('contributionTable')) return;

                    const membersSnapshot = await db.collection('users').get();
                    const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    const transactionMember = document.getElementById('transactionMember');
                    members.forEach(member => {
                        const option = document.createElement('option');
                        option.value = member.id;
                        option.textContent = member.name;
                        transactionMember.appendChild(option);
                    });

                    transactionMember.addEventListener('change', () => {
                        document.getElementById('externalNameDiv').style.display = transactionMember.value === 'external' ? 'block' : 'none';
                    });

                    const monthSelect = document.getElementById('monthSelect');
                    const contributionTable = document.getElementById('contributionTable');
                    const editMonthBtn = document.getElementById('editMonth');

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

                    loadContributions(monthSelect.value);

                    editMonthBtn.addEventListener('click', () => {
                        const isEditing = editMonthBtn.dataset.editing === 'true';
                        editMonthBtn.dataset.editing = !isEditing;
                        editMonthBtn.textContent = isEditing ? 'Edit Month' : 'Save Month';
                        loadContributions(monthSelect.value);
                    });

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
                                    e.target.checked = true;
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

                    monthSelect.addEventListener('change', () => {
                        loadContributions(monthSelect.value);
                    });

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
                        loadDashboard();
                    });

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

                // Load Profile (Member)
                async function loadProfile() {
                    if (!document.getElementById('profileForm')) return;

                    // Wait for auth state to stabilize
                    auth.onAuthStateChanged(async (user) => {
                        if (!user) {
                            alert('Not logged in. Redirecting to login...');
                            window.location.href = 'login.html';
                            return;
                        }

                        // Load Profile
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            document.getElementById('memberNumber').value = userData.memberNumber;
                            document.getElementById('name').value = userData.name;
                            document.getElementById('homeName').value = userData.homeName;
                            document.getElementById('homeNumber').value = userData.homeNumber;
                            document.getElementById('familyMembers').value = userData.familyMembers;
                            document.getElementById('primaryMobile').value = userData.primaryMobile;
                            document.getElementById('secondaryMobile').value = userData.secondaryMobile || '';
                        } else {
                            alert('User data not found. Contact admin.');
                            window.location.href = 'login.html';
                        }

                        // Update Profile
                        document.getElementById('profileForm').addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const updatedData = {
                                homeName: document.getElementById('homeName').value,
                                homeNumber: document.getElementById('homeNumber').value,
                                familyMembers: parseInt(document.getElementById('familyMembers').value),
                                primaryMobile: document.getElementById('primaryMobile').value,
                                secondaryMobile: document.getElementById('secondaryMobile').value || null
                            };
                            try {
                                await db.collection('users').doc(user.uid).update(updatedData);
                                alert('Profile updated successfully!');
                            } catch (error) {
                                alert('Profile Update Error: ' + error.message);
                            }
                        });

                        // Load Contributions
                        const monthSelect = document.getElementById('monthSelect');
                        const contributionTable = document.getElementById('contributionTable');

                        async function loadContributions(month) {
                            contributionTable.innerHTML = '';
                            const contributionDoc = await db.collection('contributions').doc(user.uid).collection('months').doc(month).get();
                            const contribution = contributionDoc.exists ? contributionDoc.data() : { paid: false, amount: 0, date: null };
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${month}</td>
                                <td>${contribution.paid ? 'Paid' : 'Unpaid'}</td>
                                <td>${contribution.amount || 0}</td>
                                <td>${contribution.date || '-'}</td>
                            `;
                            contributionTable.appendChild(row);
                        }

                        loadContributions(monthSelect.value);

                        monthSelect.addEventListener('change', () => {
                            loadContributions(monthSelect.value);
                        });

                        // Load Balance Sheet
                        const balanceTable = document.getElementById('balanceTable');
                        async function loadBalanceSheet() {
                            let totalContributions = 0;
                            let totalExpenses = 0;

                            const contributionsSnapshot = await db.collection('contributions').doc(user.uid).collection('months').get();
                            contributionsSnapshot.forEach(doc => {
                                if (doc.data().paid) {
                                    totalContributions += doc.data().amount || 0;
                                }
                            });

                            const transactionsSnapshot = await db.collection('transactions').where('memberId', '==', user.uid).get();
                            transactionsSnapshot.forEach(doc => {
                                const transaction = doc.data();
                                if (transaction.type === 'expense') {
                                    totalExpenses += transaction.amount;
                                }
                            });

                            const balance = totalContributions - totalExpenses;
                            balanceTable.innerHTML = `
                                <tr>
                                    <td>${totalContributions}</td>
                                    <td>${totalExpenses}</td>
                                    <td>${balance}</td>
                                </tr>
                            `;
                        }
                        loadBalanceSheet();
                    });
                }

                // Call appropriate function based on page
                if (document.getElementById('contributionTable') && document.getElementById('transactionTable')) {
                    loadDashboard();
                } else if (document.getElementById('profileForm')) {
                    loadProfile();
                }
            })
            .catch((error) => {
                alert('Auth Persistence Error: ' + error.message);
            });
    } catch (error) {
        alert('Firebase Initialization Error: ' + error.message);
    }
}