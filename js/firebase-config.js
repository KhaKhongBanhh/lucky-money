// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBNcD5-ypaSJa6yAg38vOh6bMZiX4YChQk",
    authDomain: "lucky-spinner-16ffe.firebaseapp.com",
    projectId: "lucky-spinner-16ffe",
    storageBucket: "lucky-spinner-16ffe.firebasestorage.app",
    messagingSenderId: "169055471078",
    appId: "1:169055471078:web:894e73983ebf6f1fa84227",
    measurementId: "G-DP36EPZJ20"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Initialize default prizes if not exists
async function initializeDefaultPrizes() {
    try {
        const prizesRef = db.collection('prizes');
        const snapshot = await prizesRef.get();
        
        if (snapshot.empty) {
            const defaultPrizes = [
                { name: '100.000đ', value: 100000, slots: 2, color: '#FF6B6B', enabled: true },
                { name: '50.000đ', value: 50000, slots: 3, color: '#4ECDC4', enabled: true },
                { name: '20.000đ', value: 20000, slots: 3, color: '#45B7D1', enabled: true },
                { name: 'Chúc may mắn', value: 0, slots: 2, color: '#96CEB4', enabled: true }
            ];
            
            for (const prize of defaultPrizes) {
                await prizesRef.add(prize);
            }
            console.log('Default prizes initialized');
        }
    } catch (error) {
        console.log('Waiting for Firestore permissions...', error.message);
    }
}

// Chỉ chạy khi không ở trang admin (tránh lỗi permission khi chưa đăng nhập)
if (!window.location.pathname.includes('admin.html')) {
    initializeDefaultPrizes();
}
