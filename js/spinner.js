document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const resultModal = document.getElementById('resultModal');
    const closeResultBtn = document.getElementById('closeResultBtn');
    const playerNameSpan = document.getElementById('playerName');
    const winnerNameSpan = document.getElementById('winnerName');
    const prizeValueSpan = document.getElementById('prizeValue');

    let prizes = [];
    let segments = [];
    let currentRotation = 0;
    let isSpinning = false;

    // Get player name from sessionStorage
    const playerName = sessionStorage.getItem('playerName');
    if (!playerName) {
        window.location.href = 'index.html';
        return;
    }
    playerNameSpan.textContent = playerName;

    // Load prizes from Firebase
    async function loadPrizes() {
        const snapshot = await db.collection('prizes').get();
        prizes = [];
        segments = [];
        
        const allPrizes = [];
        snapshot.forEach(doc => {
            const prize = { id: doc.id, ...doc.data() };
            // Ensure remaining is an integer
            if (prize.remaining === undefined || prize.remaining === null) {
                prize.remaining = -1;
            } else {
                prize.remaining = parseInt(prize.remaining, 10);
                if (isNaN(prize.remaining)) prize.remaining = -1;
            }
            prizes.push(prize);
            allPrizes.push(prize);
        });
        
        // Calculate total slots
        const totalSlots = allPrizes.reduce((sum, p) => sum + p.slots, 0);
        if (totalSlots === 0) {
            drawWheel();
            return;
        }
        
        // Create empty array for segments
        segments = new Array(totalSlots).fill(null);
        
        // Sort prizes by number of slots (descending) to place largest first
        const sortedPrizes = [...allPrizes].sort((a, b) => b.slots - a.slots);
        
        // Place each prize's slots evenly spaced around the wheel
        for (const prize of sortedPrizes) {
            if (prize.slots === 0) continue;
            const spacing = totalSlots / prize.slots;
            
            for (let i = 0; i < prize.slots; i++) {
                let idealPos = Math.round(i * spacing) % totalSlots;
                let placed = false;
                
                for (let offset = 0; offset < totalSlots && !placed; offset++) {
                    const positions = [
                        (idealPos + offset) % totalSlots,
                        (idealPos - offset + totalSlots) % totalSlots
                    ];
                    for (const pos of positions) {
                        if (segments[pos] === null) {
                            const prevPos = (pos - 1 + totalSlots) % totalSlots;
                            const nextPos = (pos + 1) % totalSlots;
                            const prevSame = segments[prevPos] && segments[prevPos].id === prize.id;
                            const nextSame = segments[nextPos] && segments[nextPos].id === prize.id;
                            if (!prevSame && !nextSame) {
                                segments[pos] = prize;
                                placed = true;
                                break;
                            }
                        }
                    }
                }
                
                if (!placed) {
                    for (let pos = 0; pos < totalSlots; pos++) {
                        if (segments[pos] === null) {
                            segments[pos] = prize;
                            break;
                        }
                    }
                }
            }
        }
        
        drawWheel();
    }

    // Draw the wheel
    function drawWheel() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        if (segments.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        
        const segmentAngle = (2 * Math.PI) / segments.length;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        segments.forEach((segment, index) => {
            const startAngle = index * segmentAngle + currentRotation;
            const endAngle = startAngle + segmentAngle;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = segment.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + segmentAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Roboto';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(segment.name, radius - 20, 5);
            ctx.restore();
        });
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#f39c12';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('QUAY', centerX, centerY + 4);
    }

    // Get eligible segment indices (enabled + has remaining)
    function getEligibleIndices() {
        const eligible = [];
        segments.forEach((seg, index) => {
            const isEligible = seg.enabled && (seg.remaining === -1 || seg.remaining > 0);
            console.log(`[ELIGIBLE] Segment ${index}: "${seg.name}" | enabled=${seg.enabled} | remaining=${seg.remaining} | eligible=${isEligible}`);
            if (isEligible) {
                eligible.push(index);
            }
        });
        console.log(`[ELIGIBLE] Total eligible: ${eligible.length} / ${segments.length}`);
        return eligible;
    }

    // MAIN SPIN FUNCTION
    async function spin() {
        if (isSpinning || segments.length === 0) return;
        
        isSpinning = true;
        spinBtn.disabled = true;
        
        try {
            // === STEP 1: Load fresh data from Firebase BEFORE spinning ===
            console.log('[SPIN] Step 1: Loading fresh prizes from Firebase...');
            await loadPrizes();
            
            // === STEP 2: Determine eligible segments ===
            const eligibleIndices = getEligibleIndices();
            console.log('[SPIN] Step 2: Eligible indices:', eligibleIndices.length, 'out of', segments.length);
            
            if (eligibleIndices.length === 0) {
                alert('Không có giải thưởng nào có thể trúng!');
                return; // finally block handles cleanup
            }
            
            // === STEP 3: Pick random winner from eligible ===
            const winningIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
            const winningSegment = segments[winningIndex];
            console.log('[SPIN] Step 3: Winner picked:', winningSegment.name, '| remaining:', winningSegment.remaining, '| id:', winningSegment.id);
            
            // === STEP 4: Animate the wheel ===
            console.log('[SPIN] Step 4: Animating wheel...');
            await animateWheel(winningIndex);
            console.log('[SPIN] Step 4: Animation complete');
            
            // === STEP 5: Update remaining count in Firebase using Transaction ===
            // 3 cases:
            //   remaining > 0  → decrease by 1
            //   remaining === 0 → should NEVER reach here (filtered by getEligibleIndices)
            //   remaining === -1 → unlimited, do NOT decrease
            console.log('[SPIN] Step 5: Updating remaining. Current value:', winningSegment.remaining);
            
            if (winningSegment.remaining === -1) {
                // CASE -1: Unlimited prize → no update needed
                console.log('[SPIN] Step 5: Prize is unlimited (-1), no update needed');
            } else {
                // CASE >0: Use Firebase Transaction to atomically read & decrement
                const prizeRef = db.collection('prizes').doc(winningSegment.id);
                await db.runTransaction(async (transaction) => {
                    const prizeDoc = await transaction.get(prizeRef);
                    if (!prizeDoc.exists) {
                        console.error('[SPIN] Step 5: Prize document not found!');
                        return;
                    }
                    const freshRemaining = prizeDoc.data().remaining;
                    console.log('[SPIN] Step 5 (transaction): Fresh remaining from DB:', freshRemaining);
                    
                    if (typeof freshRemaining === 'number' && freshRemaining > 0) {
                        // Decrement by 1
                        const newVal = freshRemaining - 1;
                        transaction.update(prizeRef, { remaining: newVal });
                        console.log('[SPIN] Step 5 (transaction): Decremented remaining from', freshRemaining, 'to', newVal);
                    } else if (freshRemaining === 0) {
                        // CASE 0: Should not happen, but safety check
                        console.warn('[SPIN] Step 5 (transaction): remaining is already 0, not decrementing');
                    } else {
                        console.warn('[SPIN] Step 5 (transaction): Unexpected remaining value:', freshRemaining);
                    }
                });
            }
            
            // === STEP 6: Save winner to Firebase ===
            console.log('[SPIN] Step 6: Saving winner...');
            await db.collection('winners').add({
                name: playerName,
                prize: winningSegment.name,
                prizeValue: winningSegment.value,
                prizeId: winningSegment.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[SPIN] Step 6: Winner saved');
            
            // === STEP 7: Reload data from Firebase to sync ===
            console.log('[SPIN] Step 7: Reloading prizes from Firebase...');
            await loadPrizes();
            console.log('[SPIN] Step 7: Prizes reloaded');
            
            // === STEP 8: Show result ===
            winnerNameSpan.textContent = playerName;
            prizeValueSpan.textContent = winningSegment.name;
            resultModal.classList.add('show');
            console.log('[SPIN] Step 8: Result shown');
            
        } catch (error) {
            console.error('[SPIN] Error during spin:', error);
            alert('Có lỗi xảy ra! Vui lòng thử lại.');
        } finally {
            // === ALWAYS unlock spin button ===
            isSpinning = false;
            spinBtn.disabled = false;
            console.log('[SPIN] Spin complete, button unlocked');
        }
    }

    // Animate wheel - returns a Promise that resolves when animation is done
    function animateWheel(winningIndex) {
        return new Promise(resolve => {
            const segmentAngleRad = (2 * Math.PI) / segments.length;
            const pointerAngle = (3 * Math.PI) / 2;
            const segmentMiddle = (winningIndex + 0.5) * segmentAngleRad;
            
            let targetRotation = pointerAngle - segmentMiddle;
            while (targetRotation < 0) {
                targetRotation += 2 * Math.PI;
            }
            
            const startRotationNormalized = currentRotation % (2 * Math.PI);
            let deltaRotation = targetRotation - startRotationNormalized;
            if (deltaRotation < 0) {
                deltaRotation += 2 * Math.PI;
            }
            
            const fullRotations = 5 + Math.floor(Math.random() * 3);
            const totalRotationRad = fullRotations * 2 * Math.PI + deltaRotation;
            
            const duration = 5000;
            const startTime = Date.now();
            const startRotation = currentRotation;
            
            function animate() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                currentRotation = startRotation + totalRotationRad * easeOut;
                drawWheel();
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve(); // Animation done
                }
            }
            
            animate();
        });
    }

    // Event listeners
    spinBtn.addEventListener('click', spin);
    
    closeResultBtn.addEventListener('click', function() {
        resultModal.classList.remove('show');
    });

    // Initialize
    loadPrizes();
});
