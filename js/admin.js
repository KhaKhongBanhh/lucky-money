document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        loadData();
    });

    const logoutBtn = document.getElementById('logoutBtn');
    const addPrizeBtn = document.getElementById('addPrizeBtn');
    const prizeModal = document.getElementById('prizeModal');
    const deleteModal = document.getElementById('deleteModal');
    const deleteWinnerModal = document.getElementById('deleteWinnerModal');
    const prizeForm = document.getElementById('prizeForm');
    const closeButtons = document.querySelectorAll('.close');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteWinnerBtn = document.getElementById('confirmDeleteWinnerBtn');
    const cancelDeleteWinnerBtn = document.getElementById('cancelDeleteWinnerBtn');
    const deleteAllWinnersBtn = document.getElementById('deleteAllWinnersBtn');

    let deleteTargetId = null;
    let deleteWinnerTargetId = null;
    let deleteAllWinnersFlag = false;

    // Logout
    logoutBtn.addEventListener('click', async function() {
        await auth.signOut();
        window.location.href = 'index.html';
    });

    // Load all data
    async function loadData() {
        await loadWinners();
        await loadPrizes();
    }

    // Load winners
    async function loadWinners() {
        try {
            const snapshot = await db.collection('winners')
                .orderBy('timestamp', 'desc')
                .get();
            
            const winnersBody = document.getElementById('winnersBody');
            winnersBody.innerHTML = '';
            
            let totalValue = 0;
            let count = 0;
            
            snapshot.forEach(doc => {
                count++;
                const data = doc.data();
                totalValue += data.prizeValue || 0;
                
                const row = document.createElement('tr');
                const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN') : 'N/A';
                
                row.innerHTML = `
                    <td>${count}</td>
                    <td>${data.name}</td>
                    <td>${data.prize}</td>
                    <td>${timestamp}</td>
                    <td>
                        <button class="action-btn delete-btn delete-winner-btn" data-id="${doc.id}" data-name="${data.name}">Xóa</button>
                    </td>
                `;
                winnersBody.appendChild(row);
            });
            
            document.getElementById('totalWinners').textContent = count;
            document.getElementById('totalValue').textContent = formatCurrency(totalValue);
            
            // Add event listeners to delete winner buttons
            document.querySelectorAll('.delete-winner-btn').forEach(btn => {
                btn.addEventListener('click', () => showDeleteWinnerModal(btn.dataset.id, btn.dataset.name));
            });
        } catch (error) {
            console.error('Error loading winners:', error);
        }
    }

    // Show delete winner modal
    function showDeleteWinnerModal(id, name) {
        deleteWinnerTargetId = id;
        deleteAllWinnersFlag = false;
        document.getElementById('deleteWinnerText').textContent = `Bạn có chắc chắn muốn xóa người trúng giải "${name}"?`;
        deleteWinnerModal.classList.add('show');
    }

    // Delete all winners button
    deleteAllWinnersBtn.addEventListener('click', function() {
        deleteAllWinnersFlag = true;
        document.getElementById('deleteWinnerText').textContent = 'Bạn có chắc chắn muốn xóa TẤT CẢ người trúng giải? Hành động này không thể hoàn tác!';
        deleteWinnerModal.classList.add('show');
    });

    // Confirm delete winner
    confirmDeleteWinnerBtn.addEventListener('click', async function() {
        try {
            if (deleteAllWinnersFlag) {
                // Delete all winners and restore prize counts
                const snapshot = await db.collection('winners').get();
                
                // Count how many times each prize was won
                const prizeCounts = {};
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.prizeId) {
                        prizeCounts[data.prizeId] = (prizeCounts[data.prizeId] || 0) + 1;
                    }
                });
                
                // Restore prize remaining counts
                for (const [prizeId, count] of Object.entries(prizeCounts)) {
                    const prizeDoc = await db.collection('prizes').doc(prizeId).get();
                    if (prizeDoc.exists) {
                        const prizeData = prizeDoc.data();
                        if (prizeData.remaining !== undefined && prizeData.remaining !== -1) {
                            await db.collection('prizes').doc(prizeId).update({
                                remaining: prizeData.remaining + count
                            });
                        }
                    }
                }
                
                // Delete all winners
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log('All winners deleted and prizes restored');
            } else if (deleteWinnerTargetId) {
                // Get winner data first to restore prize count
                const winnerDoc = await db.collection('winners').doc(deleteWinnerTargetId).get();
                const winnerData = winnerDoc.data();
                
                // Restore prize remaining count if applicable
                if (winnerData && winnerData.prizeId) {
                    const prizeDoc = await db.collection('prizes').doc(winnerData.prizeId).get();
                    if (prizeDoc.exists) {
                        const prizeData = prizeDoc.data();
                        if (prizeData.remaining !== undefined && prizeData.remaining !== -1) {
                            await db.collection('prizes').doc(winnerData.prizeId).update({
                                remaining: prizeData.remaining + 1
                            });
                        }
                    }
                }
                
                // Delete single winner
                await db.collection('winners').doc(deleteWinnerTargetId).delete();
                console.log('Winner deleted and prize restored:', deleteWinnerTargetId);
            }
            
            deleteWinnerModal.classList.remove('show');
            deleteWinnerTargetId = null;
            deleteAllWinnersFlag = false;
            loadWinners();
            loadPrizes();
        } catch (error) {
            console.error('Error deleting winner:', error);
            alert('Lỗi khi xóa! Vui lòng thử lại.');
        }
    });

    // Cancel delete winner
    cancelDeleteWinnerBtn.addEventListener('click', function() {
        deleteWinnerModal.classList.remove('show');
        deleteWinnerTargetId = null;
        deleteAllWinnersFlag = false;
    });

    // Load prizes
    async function loadPrizes() {
        try {
            const snapshot = await db.collection('prizes').get();
            const prizesBody = document.getElementById('prizesBody');
            prizesBody.innerHTML = '';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');
                
                const remaining = data.remaining !== undefined ? data.remaining : -1;
                // Only show remaining count if prize is enabled, otherwise show "-"
                let remainingText = '-';
                let remainingClass = '';
                if (data.enabled) {
                    remainingText = remaining === -1 ? '∞ Không giới hạn' : remaining;
                    remainingClass = remaining === 0 ? 'status-disabled' : (remaining === -1 ? 'status-enabled' : '');
                }
                
                row.innerHTML = `
                    <td>${data.name}</td>
                    <td>${data.slots}</td>
                    <td><span class="color-preview" style="background-color: ${data.color}"></span> ${data.color}</td>
                    <td class="${data.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${data.enabled ? '✓ Có' : '✗ Không'}
                    </td>
                    <td class="${remainingClass}">${remainingText}</td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${doc.id}">Sửa</button>
                        <button class="action-btn delete-btn prize-delete-btn" data-id="${doc.id}">Xóa</button>
                    </td>
                `;
                prizesBody.appendChild(row);
            });
            
            // Add event listeners to edit buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => editPrize(btn.dataset.id));
            });
            
            // Add event listeners to prize delete buttons
            document.querySelectorAll('.prize-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
            });
        } catch (error) {
            console.error('Error loading prizes:', error);
        }
    }

    // Add prize button
    addPrizeBtn.addEventListener('click', function() {
        document.getElementById('prizeModalTitle').textContent = 'Thêm mệnh giá mới';
        document.getElementById('prizeId').value = '';
        prizeForm.reset();
        document.getElementById('prizeRemainingType').value = 'unlimited';
        document.getElementById('prizeRemainingNumber').style.display = 'none';
        document.getElementById('prizeRemainingNumber').value = 1;
        prizeModal.classList.add('show');
    });

    // Edit prize
    async function editPrize(id) {
        try {
            const doc = await db.collection('prizes').doc(id).get();
            const data = doc.data();
            
            document.getElementById('prizeModalTitle').textContent = 'Sửa mệnh giá';
            document.getElementById('prizeId').value = id;
            document.getElementById('prizeName').value = data.name;
            document.getElementById('prizeValue').value = data.value;
            document.getElementById('prizeSlots').value = data.slots;
            document.getElementById('prizeColor').value = data.color;
            document.getElementById('prizeEnabled').checked = data.enabled;
            
            // Set remaining fields
            const remaining = data.remaining !== undefined ? parseInt(data.remaining, 10) : -1;
            if (remaining === -1 || isNaN(remaining)) {
                document.getElementById('prizeRemainingType').value = 'unlimited';
                document.getElementById('prizeRemainingNumber').style.display = 'none';
                document.getElementById('prizeRemainingNumber').value = 1;
            } else {
                document.getElementById('prizeRemainingType').value = 'limited';
                document.getElementById('prizeRemainingNumber').style.display = 'block';
                document.getElementById('prizeRemainingNumber').value = remaining;
            }
            
            prizeModal.classList.add('show');
        } catch (error) {
            console.error('Error loading prize:', error);
        }
    }

    // Prize form submit
    prizeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('prizeId').value;
        
        // Calculate remaining value
        const remainingType = document.getElementById('prizeRemainingType').value;
        let remainingValue = -1;
        if (remainingType === 'limited') {
            remainingValue = parseInt(document.getElementById('prizeRemainingNumber').value, 10);
            if (isNaN(remainingValue) || remainingValue < 0) remainingValue = 0;
        }
        
        const prizeData = {
            name: document.getElementById('prizeName').value,
            value: parseInt(document.getElementById('prizeValue').value),
            slots: parseInt(document.getElementById('prizeSlots').value),
            color: document.getElementById('prizeColor').value,
            enabled: document.getElementById('prizeEnabled').checked,
            remaining: remainingValue
        };
        
        try {
            if (id) {
                await db.collection('prizes').doc(id).update(prizeData);
            } else {
                await db.collection('prizes').add(prizeData);
            }
            
            prizeModal.classList.remove('show');
            loadPrizes();
        } catch (error) {
            console.error('Error saving prize:', error);
            alert('Lỗi khi lưu mệnh giá!');
        }
    });

    // Show delete modal (for prizes)
    function showDeleteModal(id) {
        deleteTargetId = id;
        deleteModal.classList.add('show');
    }

    // Confirm delete (for prizes)
    confirmDeleteBtn.addEventListener('click', async function() {
        if (deleteTargetId) {
            try {
                await db.collection('prizes').doc(deleteTargetId).delete();
                deleteModal.classList.remove('show');
                deleteTargetId = null;
                loadPrizes();
            } catch (error) {
                console.error('Error deleting prize:', error);
                alert('Lỗi khi xóa mệnh giá!');
            }
        }
    });

    // Cancel delete (for prizes)
    cancelDeleteBtn.addEventListener('click', function() {
        deleteModal.classList.remove('show');
        deleteTargetId = null;
    });

    // Close modals
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            prizeModal.classList.remove('show');
            deleteModal.classList.remove('show');
            if (deleteWinnerModal) deleteWinnerModal.classList.remove('show');
        });
    });

    // Close modal when clicking outside
    [prizeModal, deleteModal, deleteWinnerModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        }
    });

    // Format currency
    function formatCurrency(value) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(value);
    }
});
