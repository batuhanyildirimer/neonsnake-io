// --- 1. FIREBASE VERİTABANI KURULUMU ---
const firebaseConfig = {
    apiKey: "AIzaSyCylbpAxl13W-MGuL32ml_4Tirhx5Lj-2w",
    authDomain: "neonsnakeio-43768.firebaseapp.com",
    projectId: "neonsnakeio-43768",
    storageBucket: "neonsnakeio-43768.firebasestorage.app",
    messagingSenderId: "227075951249",
    appId: "1:227075951249:web:b5dd47fb5af5782a3d0d30"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Kullanıcının tarayıcısına özel benzersiz bir ID veriyoruz (Sürekli aynı hesabı güncellesin diye)
let myUserId = localStorage.getItem("neonSnakeUserId");
if (!myUserId) {
    myUserId = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("neonSnakeUserId", myUserId);
}

const socket = io(); 

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- HTML ELEMENTLERİ ---
const mainMenu = document.getElementById("main-menu");
const gameOverScreen = document.getElementById("game-over-screen");
const pauseMenu = document.getElementById("pause-menu");
const marketMenu = document.getElementById("market-menu");
const globalLeaderboardMenu = document.getElementById("global-leaderboard-menu");
const globalLeaderboardBody = document.getElementById("globalLeaderboardBody");

const playBtn = document.getElementById("playBtn");
const marketBtn = document.getElementById("marketBtn");
const closeMarketBtn = document.getElementById("closeMarketBtn");
const globalLeaderboardBtn = document.getElementById("globalLeaderboardBtn");
const closeGlobalLeaderboardBtn = document.getElementById("closeGlobalLeaderboardBtn");
const resumeBtn = document.getElementById("resumeBtn");
const quitBtn = document.getElementById("quitBtn");
const howToBtn = document.getElementById("howToBtn");
const restartBtn = document.getElementById("restartBtn");

const playerNameInput = document.getElementById("playerName");
const finalScoreText = document.getElementById("finalScore");
const earnedCoinsText = document.getElementById("earnedCoins");
const menuCoinsText = document.getElementById("menuCoins");
const marketCoinsText = document.getElementById("marketCoins");

// --- EKONOMİ VE KAYIT SİSTEMİ ---
let myCoins = parseInt(localStorage.getItem("neonSnakeCoins")) || 0;
let mySelectedColor = localStorage.getItem("neonSnakeColor") || "#00ffcc";

menuCoinsText.innerText = myCoins;
marketCoinsText.innerText = myCoins;

// Firebase'e sadece Coin bilgisini güncellemek için kısa fonksiyon
function updateCoinsToDB() {
    db.collection("leaderboard").doc(myUserId).set({
        coins: myCoins
    }, { merge: true }).catch(e => console.log("Veritabanı hatası:", e));
}

// --- HARİTA VE OYUN AYARLARI ---
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
let gameStarted = false;
let isPaused = false;
let myId = null;

let serverPlayers = {};
let foods = [];

// --- BİZİM YILANIMIZ ---
let mySnake = {
    x: Math.random() * (WORLD_WIDTH - 200) + 100,
    y: Math.random() * (WORLD_HEIGHT - 200) + 100,
    radius: 15, speed: 3.5, score: 0, history: [], name: "Misafir"
};

// --- SOCKET.IO ---
socket.on('init', (data) => {
    myId = data.id; serverPlayers = data.players; foods = data.foods;
});

socket.on('updateState', (playersFromServer) => {
    for (let id in playersFromServer) {
        if (id === myId) {
            if (gameStarted) mySnake.score = playersFromServer[id].score;
            continue;
        }

        if (!serverPlayers[id]) {
            serverPlayers[id] = playersFromServer[id];
            serverPlayers[id].targetX = playersFromServer[id].x;
            serverPlayers[id].targetY = playersFromServer[id].y;
        } else {
            serverPlayers[id].targetX = playersFromServer[id].x;
            serverPlayers[id].targetY = playersFromServer[id].y;
            serverPlayers[id].score = playersFromServer[id].score;
            serverPlayers[id].radius = playersFromServer[id].radius;
            serverPlayers[id].isPlaying = playersFromServer[id].isPlaying;
            serverPlayers[id].history = playersFromServer[id].history;
            serverPlayers[id].color = playersFromServer[id].color;
            serverPlayers[id].name = playersFromServer[id].name;
        }
    }
    for (let id in serverPlayers) {
        if (!playersFromServer[id]) delete serverPlayers[id];
    }
});

socket.on('foodEaten', (data) => { foods = data.newFoods; });
socket.on('foodsUpdated', (newFoods) => { foods = newFoods; });
socket.on('playerDiedBroadcast', (deadPlayerId) => {
    if (deadPlayerId === myId) endGame();
});

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
window.addEventListener("mousemove", (event) => {
    if (!isPaused) { mouse.x = event.clientX; mouse.y = event.clientY; }
});

function getDistance(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)); }

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameStarted) togglePauseMenu();
});

function togglePauseMenu() {
    isPaused = !isPaused;
    if (isPaused) pauseMenu.classList.remove("hidden");
    else pauseMenu.classList.add("hidden");
}
resumeBtn.addEventListener("click", togglePauseMenu);
quitBtn.addEventListener("click", () => {
    togglePauseMenu();
    socket.emit('playerDied');
});

// --- MENÜ VE MARKET MANTIĞI ---
marketBtn.addEventListener("click", () => {
    mainMenu.classList.add("hidden"); marketMenu.classList.remove("hidden"); marketCoinsText.innerText = myCoins;
});
closeMarketBtn.addEventListener("click", () => {
    marketMenu.classList.add("hidden"); mainMenu.classList.remove("hidden");
});

document.querySelectorAll(".skin-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        let price = parseInt(e.target.getAttribute("data-price"));
        let color = e.target.getAttribute("data-color");
        if (myCoins >= price) {
            myCoins -= price; // Parayı düş
            localStorage.setItem("neonSnakeCoins", myCoins);
            menuCoinsText.innerText = myCoins;
            marketCoinsText.innerText = myCoins;
            mySelectedColor = color;
            localStorage.setItem("neonSnakeColor", color);
            updateCoinsToDB(); // Veritabanındaki cüzdanı da güncelle
            alert("Skin başarıyla satın alındı ve seçildi!");
        } else alert("Bunun için yeterli jetonun yok kanka!");
    });
});

howToBtn.addEventListener("click", () => document.getElementById("howToPlay").classList.toggle("hidden"));

// --- GLOBAL LİDERLİK TABLOSU MANTIĞI (VERİTABANI ÇEKME) ---
globalLeaderboardBtn.addEventListener("click", () => {
    mainMenu.classList.add("hidden");
    globalLeaderboardMenu.classList.remove("hidden");
    
    globalLeaderboardBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding-top:20px;">İnternetten Veriler Çekiliyor... ⏳</td></tr>';

    // Firebase'den en yüksek skora göre ilk 10 kişiyi çek
    db.collection("leaderboard").orderBy("maxScore", "desc").limit(10).get()
    .then((querySnapshot) => {
        globalLeaderboardBody.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            let tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
            
            // Eğer bu satır "Benim" hesabıma aitse yeşil parlat
            if(doc.id === myUserId) {
                tr.style.color = "#00ffcc";
                tr.style.fontWeight = "bold";
            }

            tr.innerHTML = `
                <td style="padding: 10px 0;">#${rank}</td>
                <td style="padding: 10px 0;">${data.name}</td>
                <td style="padding: 10px 0; color: #ff3366;">${data.maxScore}</td>
                <td style="padding: 10px 0; color: gold;">${data.coins || 0} 💰</td>
            `;
            globalLeaderboardBody.appendChild(tr);
            rank++;
        });
    })
    .catch((error) => {
        globalLeaderboardBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Bağlantı hatası! Veritabanını "Test Modunda" açtın mı?</td></tr>';
    });
});

closeGlobalLeaderboardBtn.addEventListener("click", () => {
    globalLeaderboardMenu.classList.add("hidden");
    mainMenu.classList.remove("hidden");
});


function startGame() {
    let name = playerNameInput.value.trim() !== "" ? playerNameInput.value : "Misafir";
    mySnake.name = name;
    mySnake.color = mySelectedColor;
    
    mySnake.x = Math.random() * (WORLD_WIDTH - 200) + 100;
    mySnake.y = Math.random() * (WORLD_HEIGHT - 200) + 100;
    mySnake.radius = 15; mySnake.speed = 3.5; mySnake.score = 0; mySnake.history = [];
    
    gameStarted = true; isPaused = false;
    mainMenu.classList.add("hidden"); gameOverScreen.classList.add("hidden"); pauseMenu.classList.add("hidden");

    socket.emit('joinGame', { name: name, color: mySelectedColor });
}

function endGame() {
    gameStarted = false; isPaused = false;
    
    let kazanilanJeton = Math.floor(mySnake.score / 10);
    myCoins += kazanilanJeton; 
    localStorage.setItem("neonSnakeCoins", myCoins); 
    
    menuCoinsText.innerText = myCoins; 
    finalScoreText.innerText = mySnake.score; 
    earnedCoinsText.innerText = kazanilanJeton;
    
    // --- VERİTABANINA KAYDETME İŞLEMİ ---
    db.collection("leaderboard").doc(myUserId).get().then((doc) => {
        let currentMaxScore = 0;
        if (doc.exists) {
            currentMaxScore = doc.data().maxScore || 0;
        }
        // Eğer bu oyundaki skor, önceki rekorundan büyükse rekoru güncelle
        let newMaxScore = Math.max(currentMaxScore, mySnake.score);
        
        db.collection("leaderboard").doc(myUserId).set({
            name: mySnake.name,
            maxScore: newMaxScore,
            coins: myCoins,
            lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }).catch(err => console.log("Veritabanı kayıt hatası:", err));
    
    gameOverScreen.classList.remove("hidden");
}

playBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
    gameOverScreen.classList.add("hidden"); mainMenu.classList.remove("hidden");
});

// --- OYUN DÖNGÜSÜ ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gameStarted || !myId) { 
        requestAnimationFrame(gameLoop); 
        return; 
    }

    let targetX = mouse.x - (canvas.width / 2);
    let targetY = mouse.y - (canvas.height / 2);
    let angle = Math.atan2(targetY, targetX);
    
    mySnake.x += Math.cos(angle) * mySnake.speed;
    mySnake.y += Math.sin(angle) * mySnake.speed;

    if (mySnake.x < 0 || mySnake.x > WORLD_WIDTH || mySnake.y < 0 || mySnake.y > WORLD_HEIGHT) {
        socket.emit('playerDied'); return;
    }

    mySnake.radius = 15 + (mySnake.score * 0.02); 
    mySnake.speed = Math.max(2, 3.5 - (mySnake.score * 0.005));

    mySnake.history.push({ x: mySnake.x, y: mySnake.y });
    let myMaxHistory = 15 + Math.floor(mySnake.score / 15);
    while (mySnake.history.length > myMaxHistory) mySnake.history.shift();

    socket.emit('updateLocation', {
        x: mySnake.x, y: mySnake.y, history: mySnake.history, radius: mySnake.radius
    });

    let otherPlayers = Object.values(serverPlayers).filter(p => p.isPlaying && p.id !== myId);
    
    for (let i = 0; i < otherPlayers.length; i++) {
        let p = otherPlayers[i];
        if (p.targetX !== undefined && p.targetY !== undefined) {
            p.x += (p.targetX - p.x) * 0.3;
            p.y += (p.targetY - p.y) * 0.3;
        }
    }

    mySnake.id = myId;
    let allPlayersArray = [mySnake].concat(otherPlayers);

    ctx.save();
    ctx.translate(canvas.width / 2 - mySnake.x, canvas.height / 2 - mySnake.y);
    
    ctx.strokeStyle = "red"; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let i = foods.length - 1; i >= 0; i--) {
        let f = foods[i];
        ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2); ctx.fillStyle = f.color; ctx.fill(); ctx.closePath();

        if (getDistance(mySnake.x, mySnake.y, f.x, f.y) < mySnake.radius + f.radius) {
            foods.splice(i, 1);
            socket.emit('eatFood', f.id); 
        }
    }

    for (let i = 0; i < allPlayersArray.length; i++) {
        let p = allPlayersArray[i];

        if (p.id !== myId) {
             for (let k = 0; k < p.history.length; k++) {
                let segment = p.history[k];
                let segmentRadius = (k / p.history.length) * p.radius;
                
                if (getDistance(mySnake.x, mySnake.y, segment.x, segment.y) < mySnake.radius + segmentRadius) {
                    socket.emit('playerDied'); return; 
                }
            }
        }

        for (let j = 0; j < p.history.length; j++) {
            let pos = p.history[j];
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(1, (j / p.history.length) * p.radius), 0, Math.PI * 2);
            ctx.fillStyle = p.color; ctx.fill(); ctx.closePath();
        }

        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.id === myId ? "#ffffff" : p.color; 
        ctx.fill(); ctx.closePath();

        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 14px 'Poppins', sans-serif";
        ctx.fillText(p.name, p.x, p.y - p.radius - 10);
    }
    
    ctx.restore(); 

    // OYUN İÇİ ARAYÜZ
    ctx.fillStyle = "white"; ctx.textAlign = "left"; ctx.font = "bold 24px 'Poppins', sans-serif";
    ctx.fillText("Skor: " + mySnake.score, 20, 40);

    let activeSnakes = allPlayersArray.sort((a, b) => b.score - a.score);

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.fillRect(canvas.width - 220, 10, 200, 240); 
    ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "bold 18px 'Poppins', sans-serif";
    ctx.fillText("ANLIK LİDERLİK", canvas.width - 120, 40);
    
    ctx.textAlign = "left"; ctx.font = "16px 'Poppins', sans-serif";
    for (let i = 0; i < Math.min(5, activeSnakes.length); i++) {
        let s = activeSnakes[i];
        let yPos = 80 + (i * 30);
        
        if(s.id === myId) {
            ctx.fillStyle = "#00ffcc"; ctx.font = "bold 16px 'Poppins', sans-serif";
        } else {
            ctx.fillStyle = "white"; ctx.font = "16px 'Poppins', sans-serif";
        }
        
        ctx.fillText(`${i + 1}. ${s.name}`, canvas.width - 200, yPos);
        ctx.textAlign = "right"; ctx.fillText(s.score, canvas.width - 40, yPos);
        ctx.textAlign = "left"; 
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
