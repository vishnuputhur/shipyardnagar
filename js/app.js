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
                    if (cachedData.name) {
                        document.getElementById('greeting').textContent = `Hi, ${cachedData.name} & family!`;
                        document.getElementById('totalWealth').textContent = `Our Total Wealth: ₹${cachedData.totalWealth || 0}`;
                        document.getElementById('monthlyDue').textContent = `Your Monthly Due: ${cachedData.dueMonths || 0} months (₹${(cachedData.dueMonths || 0) * 200})`;
                    }

                    // Refresh from Firebase
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        document.getElementById('greeting').textContent = `Hi, ${userData.name} & family!`;

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
                        const currentMonth = new Date(2025, 9, 18); // Current date
                        const months = [];
                        for (let d = startMonth; d <= currentMonth; d.setMonth(d.getMonth() + 1)) {
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
                            name: userData.name,
                            totalWealth,
                            dueMonths
                        }));

                        // Admin Tab Visibility
                        if (userData.role === 'admin') {
                            document.getElementById('adminTab').style.display = 'block';
                        }
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
                    const email = document.getElementById('memberEmail').value;
                    const password = document.getElementById('memberPassword').value;

                    auth.signInWithEmailAndPassword(email, password)
                        .then(() => {
                            alert('Login successful! Redirecting to home...');
                            window.location.href = 'index.html';
                        })
                        .catch((error) => {
                            alert('Login Error: ' + error.message);
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
                const contributionTable = document.getElementById('subscriptionTable');
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

                // Add User Form
                document.getElementById('addUserForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const memberData = {
                        memberNumber: document.getElementById('memberNumber').value,
                        name: document.getElementById('memberName').value,
                        email: document.getElementById('email').value,
                        primaryMobile: document.getElementById('primaryMobile').value,
                        role: document.getElementById('isAdmin').checked ? 'admin' : 'member'
                    };
                    const userCredential = await auth.createUserWithEmailAndPassword(
                        memberData.email,
                        document.getElementById('password').value
                    );
                    await db.collection('users').doc(userCredential.user.uid).set(memberData);
                    alert('User added!');
                    document.getElementById('addUserForm').reset();
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
                        name: document.getElementById('editName').value,
                        email: document.getElementById('editEmail').value,
                        primaryMobile: document.getElementById('editPrimaryMobile').value,
                        role: document.getElementById('editIsAdmin').checked ? 'admin' : 'member'
                    };
                    await db.collection('users').doc(memberId).update(updatedData);
                    alert('Member updated!');
                    document.getElementById('editMemberForm').reset();
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
                    document.getElementById('editName').value = memberData.name;
                    document.getElementById('editEmail').value = memberData.email;
                    document.getElementById('editPrimaryMobile').value = memberData.primaryMobile;
                    document.getElementById('editIsAdmin').checked = memberData.role === 'admin';
                });

                // Transaction Form and Table (unchanged)
                // ...
            }

            // Load Profile (Member)
            async function loadProfile() {
                // ...
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