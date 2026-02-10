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
        try {
            const snapshot = await db.collection('prizes').get();
            prizes = [];
            segments = [];
            
            // Collect all prizes - show ALL prizes on the wheel including those with remaining = 0
            const allPrizes = [];
            snapshot.forEach(doc => {
                const prize = { id: doc.id, ...doc.data() };
                prizes.push(prize);
                allPrizes.push(prize);
                
                // Debug: Log each prize's remaining value
                console.log(`Loaded prize: "${prize.name}", enabled: ${prize.enabled}, remaining: ${prize.remaining}`);
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
                
                // Calculate ideal spacing for this prize's slots
                const spacing = totalSlots / prize.slots;
                
                for (let i = 0; i < prize.slots; i++) {
                    // Calculate ideal position
                    let idealPos = Math.round(i * spacing) % totalSlots;
                    
                    // Find nearest empty slot
                    let placed = false;
                    for (let offset = 0; offset < totalSlots && !placed; offset++) {
                        // Try positions alternating left and right of ideal
                        const positions = [
                            (idealPos + offset) % totalSlots,
                            (idealPos - offset + totalSlots) % totalSlots
                        ];
                        
                        for (const pos of positions) {
                            if (segments[pos] === null) {
                                // Check if placing here would create adjacent same prizes
                                const prevPos = (pos - 1 + totalSlots) % totalSlots;
                                const nextPos = (pos + 1) % totalSlots;
                                const prevSame = segments[prevPos] && segments[prevPos].id === prize.id;
                                const nextSame = segments[nextPos] && segments[nextPos].id === prize.id;
                                
                                // Only place if not adjacent to same prize (or if no other option)
                                if (!prevSame && !nextSame) {
                                    segments[pos] = prize;
                                    placed = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // If couldn't place without adjacency, place in any empty slot
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
        } catch (error) {
            console.error('Error loading prizes:', error);
        }
    }

    // Draw the wheel
    function drawWheel() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        const segmentAngle = (2 * Math.PI) / segments.length;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        segments.forEach((segment, index) => {
            const startAngle = index * segmentAngle + currentRotation;
            const endAngle = startAngle + segmentAngle;
            
            // Draw segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = segment.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw text
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
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#f39c12';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw center text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('QUAY', centerX, centerY + 4);
    }

    // Spin the wheel
    function spin() {
        if (isSpinning || segments.length === 0) return;
        
        isSpinning = true;
        spinBtn.disabled = true;
        
        // Get indices of ENABLED segments that have remaining stock
        const enabledIndices = [];
        const debugInfo = [];
        segments.forEach((segment, index) => {
            // Parse remaining as integer, default to -1 (unlimited) if not set
            let remaining = -1;
            if (segment.remaining !== undefined && segment.remaining !== null) {
                remaining = parseInt(segment.remaining, 10);
                if (isNaN(remaining)) remaining = -1;
            }
            
            // Only allow spinning to enabled prizes with remaining > 0 or unlimited (-1)
            // remaining === -1 means unlimited
            // remaining > 0 means has stock
            // remaining === 0 means out of stock - skip
            const canWin = segment.enabled && (remaining === -1 || remaining > 0);
            debugInfo.push(`${segment.name}: enabled=${segment.enabled}, remaining=${remaining}, canWin=${canWin}`);
            
            if (canWin) {
                enabledIndices.push(index);
            }
        });
        
        console.log('Eligible segments:', debugInfo.filter((v, i, a) => a.indexOf(v) === i).join(' | '));
        
        if (enabledIndices.length === 0) {
            alert('Không có giải thưởng nào được kích hoạt!');
            isSpinning = false;
            spinBtn.disabled = false;
            return;
        }
        
        // Select random winning segment ONLY from enabled ones
        // The wheel will physically stop at this enabled segment's position
        const randomEnabledIndex = enabledIndices[Math.floor(Math.random() * enabledIndices.length)];
        const winningIndex = randomEnabledIndex;
        const winningSegment = segments[winningIndex];
        
        // Calculate rotation
        // segmentAngle in radians
        const segmentAngleRad = (2 * Math.PI) / segments.length;
        
        // The pointer is at the top (270 degrees = 3π/2 radians from 0)
        // To land on segment winningIndex, the middle of that segment must align with the pointer
        // Middle of segment i = i * segmentAngleRad + segmentAngleRad/2 + currentRotation
        // We need: (winningIndex + 0.5) * segmentAngleRad + targetRotation = 3π/2 (mod 2π)
        // targetRotation = 3π/2 - (winningIndex + 0.5) * segmentAngleRad
        
        const pointerAngle = (3 * Math.PI) / 2; // 270 degrees, top of wheel
        const segmentMiddle = (winningIndex + 0.5) * segmentAngleRad;
        
        // Calculate where we need to end up (in radians)
        let targetRotation = pointerAngle - segmentMiddle;
        
        // Normalize to positive angle
        while (targetRotation < 0) {
            targetRotation += 2 * Math.PI;
        }
        
        // Calculate how much we need to rotate from current position
        const startRotationNormalized = currentRotation % (2 * Math.PI);
        let deltaRotation = targetRotation - startRotationNormalized;
        
        // Ensure positive rotation
        if (deltaRotation < 0) {
            deltaRotation += 2 * Math.PI;
        }
        
        // Add full rotations (5-7 spins)
        const fullRotations = 5 + Math.floor(Math.random() * 3);
        const totalRotationRad = fullRotations * 2 * Math.PI + deltaRotation;
        
        const duration = 5000; // 5 seconds
        const startTime = Date.now();
        const startRotation = currentRotation;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            currentRotation = startRotation + totalRotationRad * easeOut;
            drawWheel();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Spinning complete - update remaining IMMEDIATELY before allowing next spin
                updateRemainingAndShowResult(winningSegment);
            }
        }
        
        animate();
    }
    
    // Update remaining count immediately and show result
    async function updateRemainingAndShowResult(prize) {
        // Parse remaining as integer
        let remaining = -1;
        if (prize.remaining !== undefined && prize.remaining !== null) {
            remaining = parseInt(prize.remaining, 10);
            if (isNaN(remaining)) remaining = -1;
        }
        
        // Decrease remaining count if not unlimited (remaining > 0)
        if (remaining > 0) {
            const newRemaining = remaining - 1;
            
            // 1. UPDATE FIREBASE FIRST - WAIT for it to complete
            try {
                await db.collection('prizes').doc(prize.id).update({
                    remaining: newRemaining
                });
                console.log(`Firebase updated: Prize "${prize.name}" remaining: ${remaining} -> ${newRemaining}`);
            } catch (error) {
                console.error('Error updating Firebase remaining:', error);
            }
        }
        
        // 2. Save winner to Firebase
        try {
            await db.collection('winners').add({
                name: playerName,
                prize: prize.name,
                prizeValue: prize.value,
                prizeId: prize.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Winner saved to Firebase');
        } catch (error) {
            console.error('Error saving winner:', error);
        }
        
        // 3. RELOAD ALL PRIZES FROM FIREBASE to get fresh data
        await loadPrizes();
        console.log('Prizes reloaded from Firebase');
        
        // 4. NOW allow spinning again (after Firebase is synced)
        isSpinning = false;
        spinBtn.disabled = false;
        
        // 5. Show the result modal
        winnerNameSpan.textContent = playerName;
        prizeValueSpan.textContent = prize.name;
        resultModal.classList.add('show');
    }

    // Show result modal only (called separately if needed)
    function showResult(prize) {
        winnerNameSpan.textContent = playerName;
        prizeValueSpan.textContent = prize.name;
        resultModal.classList.add('show');
    }

    // Event listeners
    spinBtn.addEventListener('click', spin);
    
    closeResultBtn.addEventListener('click', function() {
        resultModal.classList.remove('show');
    });

    // Initialize
    loadPrizes();
});
