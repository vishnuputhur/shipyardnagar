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
                // Auth State Check for Index
                auth.onAuthStateChanged(async (user) => {
                    if (!user && window.location.pathname !== '/login.html') {
                        window.location.href = 'login.html';
                        return;
                    }

                    if (user && window.location.pathname === '/index.html') {
                        // Load Cached Data
                        const cachedData = JSON.parse(localStorage.getItem('userData') || '{}');
                        let memberName = cachedData.memberName || 'Guest';
                        document.getElementById('greeting').textContent = `Hi, ${memberName} & family!`;
                        document.getElementById('totalWealth').textContent = `Our Total Wealth: ₹${cachedData.totalWealth || 0}`;
                        document.getElementById('monthlyDue').textContent = `Your Monthly Due: ${cachedData.dueMonths || 0} months (₹${(cachedData.dueMonths || 0) * 200})`;

                        // Refresh from Firebase
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            memberName = userData.memberName || 'Guest'; // Changed back to memberName
                            document.getElementById('greeting').textContent = `Hi, ${memberName} & family!`;

                            // Profile Incomplete Check
                            if (!userData.homeName || !userData.homeNumber || !userData.familyMembers) {
                                const goToProfile = confirm('Your profile is incomplete. Please complete it.\nPress OK to go to Profile.');
                                if (goToProfile) {
                                    window.location.href = 'profile.html';
                                }
                            }

                            // Total Wealth
                            let totalIncome = 0, totalExpense = 0;
                            const transactions = await db.collection('transactions').get();
                            transactions.forEach(doc => {
                                const t = doc.data();
                                if (t.type === 'income') totalIncome += t.amount;
                                if (t.type === 'expense') totalExpense += t.amount;
                            });
                            const totalWealth = totalIncome - totalExpense;
                            document.getElementById('totalWealth').textContent = `Our Total Wealth: ₹${totalWealth}`;

                            // Monthly Due
                            const startMonth = new Date(2025, 9, 1); // Oct 2025
                            const currentMonth = new Date(2025, 9, 18); // Current date: Oct 18, 2025
                            const months = [];
                            for (let d = new Date(startMonth); d <= currentMonth; d.setMonth(d.getMonth() + 1)) {
                                months.push(d.toISOString().slice(0, 7));
                            }
                            let dueMonths = 0;
                            for (const month of months) {
                                const contribution = await db.collection('contributions').doc(user.uid).collection('months').doc(month).get();
                                if (!contribution.exists || !contribution.data().paid) dueMonths++;
                            }
                            document.getElementById('monthlyDue').textContent = `Your Monthly Due: ${dueMonths} months (₹${dueMonths * 200})`;

                            // Cache Data
                            localStorage.setItem('userData', JSON.stringify({
                                memberName: memberName, // Changed back to memberName
                                totalWealth,
                                dueMonths
                            }));

                            // Admin Tab Visibility
                            const adminTab = document.getElementById('adminTab');
                            if (adminTab) {
                                adminTab.style.display = userData.role === 'admin' ? 'block' : 'none';
                            } else {
                                console.error('adminTab element not found in index.html');
                            }
                        } else {
                            console.error(`User data not found for UID: ${user.uid}`);
                        }
                    }
                });

                // Admin Tab Check
                window.checkAdmin = async function() {
                    const user = auth.currentUser;
                    if (user) {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists && userDoc.data().role === 'admin') {
                            window.location.href = 'dashboard.html';
                        } else {
                            alert('You are not an admin.');
                        }
                    }
                };

                // Member Login
                if (document.getElementById('memberLoginForm')) {
                    document.getElementById('memberLoginForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const email = document.getElementById('memberEmail').value.trim();
                        const password = document.getElementById('memberPassword').value;

                        // Email validation
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email)) {
                            alert('Please enter a valid email address.');
                            return;
                        }

                        auth.signInWithEmailAndPassword(email, password)
                            .then(() => {
                                alert('Login successful! Redirecting to home...');
                                window.location.href = 'index.html';
                            })
                            .catch((error) => {
                                alert('Login Error: ' + error.message);
                                console.error('Firebase Error:', error); // For debugging
                            });
                    });

                    document.getElementById('memberForgotPassword').addEventListener('click', () => {
                        const email = document.getElementById('memberEmail').value.trim();
                        if (email && emailRegex.test(email)) {
                            auth.sendPasswordResetEmail(email)
                                .then(() => alert('Password reset email sent!'))
                                .catch((error) => alert('Forgot Password Error: ' + error.message));
                        } else {
                            alert('Please enter a valid email first!');
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
                    if (!document.getElementById('subscriptionTable')) return;

                    const membersSnapshot = await db.collection('users').get();
                    const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Add User Form Toggle
                    document.getElementById('addUserBtn').addEventListener('click', () => {
                        document.getElementById('addUserSection').style.display = 'block';
                        document.getElementById('editMemberSection').style.display = 'none';
                        document.getElementById('subscriptionSection').style.display = 'none';
                    });

                    // Edit Member Form Toggle
                    document.getElementById('editMemberBtn').addEventListener('click', () => {
                        document.getElementById('addUserSection').style.display = 'none';
                        document.getElementById('editMemberSection').style.display = 'block';
                        document.getElementById('subscriptionSection').style.display = 'none';
                    });

                    // Subscription Section Toggle
                    document.getElementById('subscriptionBtn').addEventListener('click', () => {
                        document.getElementById('addUserSection').style.display = 'none';
                        document.getElementById('editMemberSection').style.display = 'none';
                        document.getElementById('subscriptionSection').style.display = 'block';
                        loadSubscriptionTable();
                    });

                    const transactionMember = document.getElementById('transactionMember');
                    members.forEach(member => {
                        const option = document.createElement('option');
                        option.value = member.id;
                        option.textContent = member.memberName || 'Unknown'; // Changed to memberName
                        transactionMember.appendChild(option);
                    });

                    transactionMember.addEventListener('change', () => {
                        document.getElementById('externalNameDiv').style.display = transactionMember.value === 'external' ? 'block' : 'none';
                    });

                    const monthSelect = document.getElementById('monthSelect');
                    const contributionTable = document.getElementById('subscriptionTable');
                    const editMonthBtn = document.getElementById('editMonth');

                    async function loadContributions(month) {
                        contributionTable.innerHTML = '';
                        for (const member of members) {
                            const contributionDoc = await db.collection('contributions').doc(member.id).collection('months').doc(month).get();
                            const contribution = contributionDoc.exists ? contributionDoc.data() : { paid: false };
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${member.memberName || 'Unknown'}</td> <!-- Changed to memberName -->
                                <td><input type="checkbox" class="contribution-check" data-member="${member.id}" ${contribution.paid ? 'checked' : ''} ${editMonthBtn.dataset.editing === 'true' ? '' : 'disabled'}></td>
                            `;
                            contributionTable.appendChild(row);
                        }
                    }

                    function loadSubscriptionTable() {
                        const startMonth = new Date(2025, 9, 1); // Oct 2025
                        const currentMonth = new Date(2025, 9, 18); // Current date: Oct 18, 2025
                        const months = [];
                        for (let d = new Date(startMonth); d <= currentMonth; d.setMonth(d.getMonth() + 1)) {
                            months.push(d.toISOString().slice(0, 7));
                        }
                        monthSelect.innerHTML = months.map(m => `<option value="${m}">${m.split('-')[1]} ${m.split('-')[0]}</option>`).join('');
                        monthSelect.value = currentMonth.toISOString().slice(0, 7); // Auto scroll to current month
                        loadContributions(monthSelect.value);
                    }

                    loadSubscriptionTable();

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
                            const month = monthSelect.value;
                            if (!paid) {
                                if (confirm('Are you sure you want to remove this payment?')) {
                                    await db.collection('contributions').doc(memberId).collection('months').doc(month).set({
                                        paid: false,
                                        date: null,
                                        amount: 0
                                    });
                                } else {
                                    e.target.checked = true;
                                }
                            } else {
                                await db.collection('contributions').doc(memberId).collection('months').doc(month).set({
                                    paid: true,
                                    date: new Date().toISOString().split('T')[0],
                                    amount: 200
                                });
                                await db.collection('transactions').add({
                                    type: 'income',
                                    memberId: memberId,
                                    amount: 200,
                                    head: `Monthly Subscription - ${month}`,
                                    date: new Date().toISOString().split('T')[0]
                                });
                            }
                            loadContributions(month);
                        }
                    });

                    monthSelect.addEventListener('change', () => {
                        loadContributions(monthSelect.value);
                    });

                    // Add User Form
                    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const memberData = {
                            memberNumber: document.getElementById('memberNumber').value,
                            memberName: document.getElementById('memberName').value, // Changed back to memberName
                            email: document.getElementById('email').value,
                            primaryMobile: document.getElementById('primaryMobile').value,
                            role: document.getElementById('isAdmin').checked ? 'admin' : 'member'
                        };
                        try {
                            const userCredential = await auth.createUserWithEmailAndPassword(
                                memberData.email,
                                document.getElementById('password').value
                            );
                            await db.collection('users').doc(userCredential.user.uid).set(memberData);
                            alert('User added successfully!');
                            document.getElementById('addUserForm').reset();
                            loadSubscriptionTable(); // Refresh members list
                        } catch (error) {
                            alert('Error adding user: ' + error.message);
                        }
                    });

                    // Edit Member
                    document.getElementById('editMemberForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const memberNumber = document.getElementById('editMemberNumber').value;
                        const membersSnapshot = await db.collection('users').where('memberNumber', '==', memberNumber).get();
                        if (membersSnapshot.empty) {
                            alert('Member not found!');
                            return;
                        }
                        const memberDoc = membersSnapshot.docs[0];
                        const memberId = memberDoc.id;
                        const updatedData = {
                            memberName: document.getElementById('editName').value, // Changed back to memberName
                            email: document.getElementById('editEmail').value,
                            primaryMobile: document.getElementById('editPrimaryMobile').value,
                            role: document.getElementById('editIsAdmin').checked ? 'admin' : 'member'
                        };
                        await db.collection('users').doc(memberId).update(updatedData);
                        alert('Member updated successfully!');
                        document.getElementById('editMemberForm').reset();
                        document.getElementById('editMemberForm').style.display = 'none';
                        loadSubscriptionTable(); // Refresh members list
                    });

                    // Load Edit Member Form
                    document.getElementById('loadEditMember').addEventListener('click', async () => {
                        const memberNumber = document.getElementById('editMemberNumber').value;
                        const membersSnapshot = await db.collection('users').where('memberNumber', '==', memberNumber).get();
                        if (membersSnapshot.empty) {
                            alert('Member not found!');
                            return;
                        }
                        const memberData = membersSnapshot.docs[0].data();
                        document.getElementById('editName').value = memberData.memberName || ''; // Changed to memberName
                        document.getElementById('editEmail').value = memberData.email || '';
                        document.getElementById('editPrimaryMobile').value = memberData.primaryMobile || '';
                        document.getElementById('editIsAdmin').checked = memberData.role === 'admin';
                        document.getElementById('editMemberForm').style.display = 'block';
                    });

                    // Transaction Form and Table (unchanged)
                    // ...
                }

                // Load Profile (Member)
                async function loadProfile() {
                    if (!document.getElementById('profileForm')) return;

                    auth.onAuthStateChanged(async (user) => {
                        if (!user) {
                            alert('Not logged in. Redirecting to login...');
                            window.location.href = 'login.html';
                            return;
                        }

                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            document.getElementById('memberNumber').value = userData.memberNumber || '';
                            document.getElementById('name').value = userData.memberName || ''; // Changed to memberName
                            document.getElementById('homeName').value = userData.homeName || '';
                            document.getElementById('homeNumber').value = userData.homeNumber || '';
                            document.getElementById('familyMembers').value = userData.familyMembers || '';
                            document.getElementById('primaryMobile').value = userData.primaryMobile || '';
                            document.getElementById('secondaryMobile').value = userData.secondaryMobile || '';

                            document.getElementById('profileForm').addEventListener('submit', async (e) => {
                                e.preventDefault();
                                const updatedData = {
                                    homeName: document.getElementById('homeName').value,
                                    homeNumber: document.getElementById('homeNumber').value,
                                    familyMembers: parseInt(document.getElementById('familyMembers').value) || 0,
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
                        } else {
                            alert(`User data not found for UID ${user.uid}. Contact admin.`);
                            window.location.href = 'login.html';
                        }
                    });
                }

                // Call appropriate function based on page
                if (document.getElementById('subscriptionTable')) {
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

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}