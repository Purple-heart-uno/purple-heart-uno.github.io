// Глобальные переменные
let currentRole = '';
let currentPlayer = null;
let peer = null;
let connections = new Map();
let currentRoomId = null;
let players = new Map();

let incomes = [];
let expenses = [];
let assets = [];
let liabilities = [];

// Инициализация PeerJS
async function initializePeer() {
    return new Promise((resolve, reject) => {
        peer = new Peer({
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('Connected with ID:', id);
            resolve(id);
        });

        peer.on('error', (error) => {
            console.error('PeerJS error:', error);
            reject(error);
        });

        // Обработка входящих соединений (для банкира)
        peer.on('connection', (conn) => {
            setupConnection(conn);
        });
    });
}

// Настройка соединения
function setupConnection(conn) {
    conn.on('open', () => {
        console.log('Connected to:', conn.peer);
        connections.set(conn.peer, conn);
        updateUI();
    });

    conn.on('data', (data) => {
        handleMessage(data, conn);
    });

    conn.on('close', () => {
        console.log('Disconnected from:', conn.peer);
        connections.delete(conn.peer);
        players.delete(conn.peer);
        updateUI();
        showNotification('Игрок отключился', 'warning');
    });

    conn.on('error', (error) => {
        console.error('Connection error:', error);
        showNotification('Ошибка соединения', 'error');
    });
}

// Обработка сообщений
function handleMessage(data, conn) {
    console.log('Received:', data);

    switch (data.type) {
        case 'player_join':
            if (currentRole === 'banker') {
                players.set(data.playerData.id, data.playerData);
                updateUI();

                // Рассылаем обновленный список всем
                broadcast({
                    type: 'players_update',
                    players: Array.from(players.values())
                });

                showNotification(`Игрок ${data.playerData.name} подключился`, 'success');
            }
            break;

        case 'players_update':
            if (!currentRole === 'banker') {
                players = new Map(data.players.map(p => [p.id, p]));
                updateUI();
            }
            break;

        case 'salary_payment':
            if (!currentRole === 'banker') {
                updateBalance(data.amount);
                showNotification(`💰 Получена зарплата: $${data.amount}`, 'success');
            }
            break;

        case 'transaction':
            if (!currentRole === 'banker' && data.targetPlayerId === peer.id) {
                const amount = data.transactionType === 'income' ? data.amount : -data.amount;
                updateBalance(amount);
                showNotification(`📊 ${data.description}: $${data.amount}`, 'info');
            }
            break;

        case 'qr_scanned':
            if (currentRole === 'banker') {
                showNotification(`📷 Игрок ${data.playerName} отсканировал QR-код`, 'success');
            }
            break;
    }
}

// Рассылка сообщений всем подключенным
function broadcast(message) {
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

// Инициализация игры
function selectRole(role) {
    currentRole = role;
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('registrationForm').style.display = 'block';

    const title = document.getElementById('formTitle');
    if (role === 'banker') {
        title.textContent = 'Регистрация Банкира';
    } else {
        title.textContent = 'Регистрация Игрока';
    }
}

async function startGame() {
    const playerName = document.getElementById('playerName').value;
    const profession = document.getElementById('profession').value;
    const initialBalance = parseInt(document.getElementById('initialBalance').value);

    if (!playerName || !profession) {
        alert('Заполните все поля');
        return;
    }

    currentPlayer = {
        name: playerName,
        profession: profession,
        balance: initialBalance
    };

    document.getElementById('registrationForm').style.display = 'none';
    document.getElementById('gameInterface').style.display = 'block';

    // Заполняем данные из формы
    document.getElementById('displayName').textContent = playerName;
    document.getElementById('displayProfession').textContent = profession;
    document.getElementById('displayBalance').textContent = '$' + initialBalance.toLocaleString();

    try {
        // Инициализируем PeerJS
        await initializePeer();

        if (currentRole === 'banker') {
            // Банкир создает комнату
            await createRoom();
            document.getElementById('bankerPanel').style.display = 'block';
            showNotification('Комната создана! Покажите QR-код игрокам', 'success');
        } else {
            // Игрок показывает свою панель
            document.getElementById('playerPanel').style.display = 'block';
            showNotification('Готов к подключению! Отсканируйте QR-код комнаты', 'info');
        }
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Ошибка подключения. Проверьте интернет и попробуйте снова.');
        return;
    }

    // Настройка обработчиков для форм активов
    document.getElementById('assetType').addEventListener('change', function () {
        const type = this.value;
        document.getElementById('stocksFields').style.display = type === 'stocks' ? 'flex' : 'none';
        document.getElementById('realestateFields').style.display = type === 'realestate' ? 'flex' : 'none';
        document.getElementById('businessFields').style.display = type === 'business' ? 'flex' : 'none';
        document.getElementById('otherAssetFields').style.display = type === 'other' ? 'flex' : 'none';
    });

    updateSalarySummary();

    // Восстанавливаем данные из localStorage
    loadFromStorage();
}

// Создание комнаты (Банкир)
async function createRoom() {
    currentRoomId = peer.id;
    players.set(currentRoomId, {
        ...currentPlayer,
        id: currentRoomId,
        role: 'banker'
    });

    // Сохраняем в localStorage
    saveToStorage();

    return currentRoomId;
}

// Подключение к комнате (Игрок)
async function joinRoom(roomId) {
    if (!roomId) {
        alert('Введите ID комнаты');
        return;
    }

    if (roomId === peer.id) {
        alert('Нельзя подключиться к своей же комнате');
        return;
    }

    try {
        const conn = peer.connect(roomId);
        await setupConnection(conn);

        // Отправляем данные игрока банкиру
        conn.send({
            type: 'player_join',
            playerData: {
                ...currentPlayer,
                id: peer.id,
                role: 'player'
            }
        });

        currentRoomId = roomId;
        showNotification('Успешно подключено к комнате!', 'success');
        return true;
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Ошибка подключения к комнате. Проверьте ID комнаты.');
        return false;
    }
}

// Управление формами
function toggleAddForm(type) {
    const forms = ['incomeForm', 'expenseForm', 'assetForm', 'liabilityForm'];
    forms.forEach(form => {
        const formElement = document.getElementById(form);
        if (formElement) {
            formElement.style.display = 'none';
        }
    });

    const targetForm = document.getElementById(type + 'Form');
    if (targetForm) {
        targetForm.style.display = targetForm.style.display === 'block' ? 'none' : 'block';
    }

    resetForm(type);
}

function resetForm(type) {
    if (type === 'asset') {
        document.getElementById('assetName').value = '';
        document.getElementById('assetType').value = 'stocks';
        document.getElementById('stocksQuantity').value = '';
        document.getElementById('stocksPrice').value = '';
        document.getElementById('downPayment').value = '';
        document.getElementById('propertyPrice').value = '';
        document.getElementById('businessDownPayment').value = '';
        document.getElementById('businessPrice').value = '';
        document.getElementById('assetDetails').value = '';

        document.getElementById('stocksFields').style.display = 'flex';
        document.getElementById('realestateFields').style.display = 'none';
        document.getElementById('businessFields').style.display = 'none';
        document.getElementById('otherAssetFields').style.display = 'none';
    } else if (type === 'income') {
        document.getElementById('incomeName').value = '';
        document.getElementById('incomeAmount').value = '';
    } else if (type === 'expense') {
        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
    } else if (type === 'liability') {
        document.getElementById('liabilityName').value = '';
        document.getElementById('liabilityDetails').value = '';
    }
}

// Добавление доходов, расходов, активов, пассивов
function addIncome() {
    const name = document.getElementById('incomeName').value;
    const amount = parseFloat(document.getElementById('incomeAmount').value);

    if (name && amount) {
        const income = {
            id: Date.now(),
            name: name,
            amount: amount
        };
        incomes.push(income);
        renderIncomes();
        updateSalarySummary();
        toggleAddForm('income');
        saveToStorage();
    } else {
        alert('Заполните все поля');
    }
}

function addExpense() {
    const name = document.getElementById('expenseName').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);

    if (name && amount) {
        const expense = {
            id: Date.now(),
            name: name,
            amount: amount
        };
        expenses.push(expense);
        renderExpenses();
        updateSalarySummary();
        toggleAddForm('expense');
        saveToStorage();
    } else {
        alert('Заполните все поля');
    }
}

function addAsset() {
    const name = document.getElementById('assetName').value;
    const type = document.getElementById('assetType').value;
    let details = '';

    if (!name) {
        alert('Введите название актива');
        return;
    }

    if (type === 'stocks') {
        const quantity = document.getElementById('stocksQuantity').value;
        const price = document.getElementById('stocksPrice').value;
        if (!quantity || !price) {
            alert('Заполните все поля для акций');
            return;
        }
        details = `${quantity} акций по $${price}`;
    } else if (type === 'realestate') {
        const downPayment = document.getElementById('downPayment').value;
        const propertyPrice = document.getElementById('propertyPrice').value;
        if (!downPayment || !propertyPrice) {
            alert('Заполните все поля для недвижимости');
            return;
        }
        details = `Взнос: $${downPayment}, Цена: $${propertyPrice}`;
    } else if (type === 'business') {
        const downPayment = document.getElementById('businessDownPayment').value;
        const businessPrice = document.getElementById('businessPrice').value;
        if (!downPayment || !businessPrice) {
            alert('Заполните все поля для бизнеса');
            return;
        }
        details = `Взнос: $${downPayment}, Цена: $${businessPrice}`;
    } else {
        details = document.getElementById('assetDetails').value || 'Описание отсутствует';
    }

    const asset = {
        id: Date.now(),
        name: name,
        type: type,
        details: details
    };
    assets.push(asset);
    renderAssets();
    toggleAddForm('asset');
    saveToStorage();
}

function addLiability() {
    const name = document.getElementById('liabilityName').value;
    const details = document.getElementById('liabilityDetails').value;

    if (name) {
        const liability = {
            id: Date.now(),
            name: name,
            details: details || 'Описание отсутствует'
        };
        liabilities.push(liability);
        renderLiabilities();
        toggleAddForm('liability');
        saveToStorage();
    } else {
        alert('Введите название пассива');
    }
}

// Удаление элементов
function deleteIncome(id) {
    incomes = incomes.filter(income => income.id !== id);
    renderIncomes();
    updateSalarySummary();
    saveToStorage();
}

function deleteExpense(id) {
    expenses = expenses.filter(expense => expense.id !== id);
    renderExpenses();
    updateSalarySummary();
    saveToStorage();
}

function deleteAsset(id) {
    assets = assets.filter(asset => asset.id !== id);
    renderAssets();
    saveToStorage();
}

function deleteLiability(id) {
    liabilities = liabilities.filter(liability => liability.id !== id);
    renderLiabilities();
    saveToStorage();
}

// Рендеринг списков
function renderIncomes() {
    const incomeList = document.getElementById('incomeList');
    incomeList.innerHTML = '';

    incomes.forEach(income => {
        const li = document.createElement('li');
        li.className = 'item income-item';
        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${income.name}</span>
                <span class="item-details">Доход: $${income.amount}/мес</span>
            </div>
            <button class="delete-btn" onclick="deleteIncome(${income.id})">×</button>
        `;
        incomeList.appendChild(li);
    });
}

function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';

    expenses.forEach(expense => {
        const li = document.createElement('li');
        li.className = 'item expense-item';
        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${expense.name}</span>
                <span class="item-details">Расход: $${expense.amount}/мес</span>
            </div>
            <button class="delete-btn" onclick="deleteExpense(${expense.id})">×</button>
        `;
        expensesList.appendChild(li);
    });
}

function renderAssets() {
    const assetsList = document.getElementById('assetsList');
    assetsList.innerHTML = '';

    assets.forEach(asset => {
        const li = document.createElement('li');
        li.className = 'item asset-item';
        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${asset.name}</span>
                <span class="item-details">${asset.details}</span>
            </div>
            <button class="delete-btn" onclick="deleteAsset(${asset.id})">×</button>
        `;
        assetsList.appendChild(li);
    });
}

function renderLiabilities() {
    const liabilitiesList = document.getElementById('liabilitiesList');
    liabilitiesList.innerHTML = '';

    liabilities.forEach(liability => {
        const li = document.createElement('li');
        li.className = 'item liability-item';
        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${liability.name}</span>
                <span class="item-details">${liability.details}</span>
            </div>
            <button class="delete-btn" onclick="deleteLiability(${liability.id})">×</button>
        `;
        liabilitiesList.appendChild(li);
    });
}

// Расчет зарплаты
function updateSalarySummary() {
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const salary = totalIncome - totalExpenses;

    document.getElementById('totalIncome').textContent = '$' + totalIncome;
    document.getElementById('totalExpenses').textContent = '$' + totalExpenses;
    document.getElementById('salaryAmount').textContent = '$' + salary;
}

// Функции банкира
function paySalary() {
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const salary = totalIncome - totalExpenses;

    if (salary > 0) {
        broadcast({
            type: 'salary_payment',
            amount: salary,
            description: 'Ежемесячная зарплата'
        });

        // Обновляем балансы у банкира
        players.forEach(player => {
            if (player.role === 'player') {
                player.balance += salary;
            }
        });

        updateUI();
        showNotification(`✅ Зарплата $${salary} выдана всем игрокам`, 'success');
        saveToStorage();
    } else {
        showNotification('❌ Зарплата не может быть отрицательной!', 'error');
    }
}

function showTransactionModal() {
    // Обновляем список игроков в модальном окне
    const transactionPlayer = document.getElementById('transactionPlayer');
    transactionPlayer.innerHTML = '';

    players.forEach(player => {
        if (player.role === 'player') {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.name} ($${player.balance})`;
            transactionPlayer.appendChild(option);
        }
    });

    document.getElementById('transactionModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function processTransaction() {
    const playerId = document.getElementById('transactionPlayer').value;
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const description = document.getElementById('transactionDescription').value;

    if (!playerId || !amount || !description) {
        showNotification('❌ Заполните все поля', 'error');
        return;
    }

    const targetConn = connections.get(playerId);
    if (targetConn && targetConn.open) {
        targetConn.send({
            type: 'transaction',
            targetPlayerId: playerId,
            transactionType: type,
            amount: amount,
            description: description
        });

        // Обновляем баланс у банкира
        const player = players.get(playerId);
        if (player) {
            player.balance += type === 'income' ? amount : -amount;
        }

        updateUI();
        showNotification(`✅ Транзакция выполнена: ${description}`, 'success');
        saveToStorage();
    } else {
        showNotification('❌ Игрок не подключен', 'error');
    }

    closeModal('transactionModal');
}

// QR-код функции
function showQRCodeModal() {
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const salary = totalIncome - totalExpenses;

    if (salary <= 0) {
        showNotification('❌ Нет зарплаты для выдачи', 'error');
        return;
    }

    const qrData = JSON.stringify({
        type: 'salary_request',
        amount: salary,
        roomId: currentRoomId,
        timestamp: Date.now()
    });

    showQRCode(qrData, 'Отсканируйте этот код для получения зарплаты');
}

function showQRCode(data, description = 'Отсканируйте QR-код') {
    const qrcodeDiv = document.getElementById('qrcode');
    const qrDescription = document.getElementById('qrDescription');

    if (qrcodeDiv && qrDescription) {
        qrcodeDiv.innerHTML = '';
        qrDescription.textContent = description;

        QRCode.toCanvas(qrcodeDiv, data, {
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        }, function (error) {
            if (error) {
                console.error(error);
                showNotification('❌ Ошибка генерации QR-кода', 'error');
                return;
            }
        });

        document.getElementById('qrModal').style.display = 'block';
    }
}

// Сканирование QR-кода комнаты (игроки)
function scanRoomQR() {
    const roomId = prompt('Введите ID комнаты (или отсканируйте QR-код):');
    if (roomId) {
        joinRoom(roomId);
    }
}

// Сканирование QR-кода зарплаты (игроки)
function scanSalaryQR() {
    const qrData = prompt('Введите данные QR-кода зарплаты:');
    if (qrData) {
        try {
            const data = JSON.parse(qrData);

            if (data.type === 'salary_request' && data.roomId === currentRoomId) {
                // Уведомляем банкира о сканировании
                broadcast({
                    type: 'qr_scanned',
                    playerId: peer.id,
                    playerName: currentPlayer.name
                });

                // Получаем зарплату
                updateBalance(data.amount);
                showNotification(`✅ Получена зарплата: $${data.amount}`, 'success');
            } else {
                showNotification('❌ Неверный QR-код', 'error');
            }
        } catch (error) {
            showNotification('❌ Неверный формат QR-кода', 'error');
        }
    }
}

// Обновление UI
function updateUI() {
    if (currentRole === 'banker') {
        const playersList = document.getElementById('playersList');
        if (playersList) {
            playersList.innerHTML = '';
            players.forEach(player => {
                if (player.role === 'player') {
                    const div = document.createElement('div');
                    div.className = 'player-item';
                    div.innerHTML = `
                        <strong>${player.name}</strong><br>
                        Профессия: ${player.profession}<br>
                        Баланс: $${player.balance}
                    `;
                    playersList.appendChild(div);
                }
            });
        }
    }
}

// Обновление баланса
function updateBalance(amount) {
    if (currentPlayer) {
        currentPlayer.balance += amount;
        document.getElementById('displayBalance').textContent = '$' + currentPlayer.balance.toLocaleString();
        saveToStorage();
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Сохранение и загрузка из localStorage
function saveToStorage() {
    const gameData = {
        currentPlayer,
        incomes,
        expenses,
        assets,
        liabilities,
        currentRole,
        currentRoomId,
        players: Array.from(players.entries())
    };
    localStorage.setItem('cashflow_game_data', JSON.stringify(gameData));
}

function loadFromStorage() {
    const saved = localStorage.getItem('cashflow_game_data');
    if (saved) {
        try {
            const gameData = JSON.parse(saved);

            currentPlayer = gameData.currentPlayer || currentPlayer;
            incomes = gameData.incomes || [];
            expenses = gameData.expenses || [];
            assets = gameData.assets || [];
            liabilities = gameData.liabilities || [];
            currentRole = gameData.currentRole || currentRole;
            currentRoomId = gameData.currentRoomId || currentRoomId;
            players = new Map(gameData.players || []);

            // Обновляем интерфейс
            renderIncomes();
            renderExpenses();
            renderAssets();
            renderLiabilities();
            updateSalarySummary();
            updateUI();

            if (currentPlayer) {
                document.getElementById('displayBalance').textContent = '$' + currentPlayer.balance.toLocaleString();
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', function () {
    // Закрытие модальных окон при клике вне их
    window.onclick = function (event) {
        const modals = document.getElementsByClassName('modal');
        for (let modal of modals) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
    };

    // Загружаем данные при загрузке страницы
    loadFromStorage();
});

// Добавляем CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Добавьте эти функции в конец game.js

// Выход из игры и сброс профиля
function logout() {
    if (confirm('Вы уверены, что хотите выйти? Все несохраненные данные будут потеряны.')) {
        // Очищаем соединения
        if (peer) {
            peer.destroy();
        }
        connections.clear();
        players.clear();

        // Очищаем данные игры
        incomes = [];
        expenses = [];
        assets = [];
        liabilities = [];

        // Очищаем localStorage (или оставляем для восстановления - на ваш выбор)
        // localStorage.removeItem('cashflow_game_data'); // Раскомментируйте для полного сброса

        // Возвращаем к выбору роли
        document.getElementById('gameInterface').style.display = 'none';
        document.getElementById('bankerPanel').style.display = 'none';
        document.getElementById('playerPanel').style.display = 'none';
        document.getElementById('roleSelection').style.display = 'block';

        // Сбрасываем текущего игрока
        currentPlayer = null;
        currentRole = '';
        currentRoomId = null;

        showNotification('Вы вышли из игры', 'info');
    }
}

// Создание нового персонажа
function createNewCharacter() {
    if (confirm('Создать нового персонажа? Текущий прогресс будет сохранен, но вы сможете начать с новыми данными.')) {
        // Сохраняем старые данные (опционально)
        const oldData = {
            incomes,
            expenses,
            assets,
            liabilities
        };

        // Сбрасываем данные
        incomes = [];
        expenses = [];
        assets = [];
        liabilities = [];

        // Очищаем интерфейс
        renderIncomes();
        renderExpenses();
        renderAssets();
        renderLiabilities();
        updateSalarySummary();

        // Сбрасываем баланс к начальному
        if (currentPlayer) {
            currentPlayer.balance = parseInt(document.getElementById('initialBalance').value) || 1000;
            document.getElementById('displayBalance').textContent = '$' + currentPlayer.balance.toLocaleString();
        }

        // Сохраняем
        saveToStorage();
        showNotification('Новый персонаж создан!', 'success');
    }
}

// Менеджер профилей
function showProfileManager() {
    const profiles = getSavedProfiles();

    let message = 'Сохраненные профили:\n\n';
    profiles.forEach((profile, index) => {
        message += `${index + 1}. ${profile.name} (${profile.profession}) - $${profile.balance}\n`;
    });

    message += '\nВыберите действие:\n';
    message += '1 - Продолжить с текущим профилем\n';
    message += '2 - Создать новый профиль\n';
    message += '3 - Загрузить другой профиль';

    const choice = prompt(message);

    switch (choice) {
        case '2':
            createNewCharacter();
            break;
        case '3':
            loadProfile();
            break;
        default:
            // Продолжаем с текущим
            break;
    }
}

// Загрузка профиля
function loadProfile() {
    const profiles = getSavedProfiles();

    if (profiles.length === 0) {
        alert('Нет сохраненных профилей');
        return;
    }

    let message = 'Выберите профиль для загрузки:\n\n';
    profiles.forEach((profile, index) => {
        message += `${index + 1}. ${profile.name} (${profile.profession}) - $${profile.balance}\n`;
    });

    const choice = parseInt(prompt(message)) - 1;

    if (choice >= 0 && choice < profiles.length) {
        const selectedProfile = profiles[choice];

        // Загружаем данные профиля
        currentPlayer = selectedProfile.player;
        incomes = selectedProfile.incomes || [];
        expenses = selectedProfile.expenses || [];
        assets = selectedProfile.assets || [];
        liabilities = selectedProfile.liabilities || [];

        // Обновляем интерфейс
        document.getElementById('displayName').textContent = currentPlayer.name;
        document.getElementById('displayProfession').textContent = currentPlayer.profession;
        document.getElementById('displayBalance').textContent = '$' + currentPlayer.balance.toLocaleString();

        renderIncomes();
        renderExpenses();
        renderAssets();
        renderLiabilities();
        updateSalarySummary();

        showNotification(`Профиль "${currentPlayer.name}" загружен`, 'success');
    }
}

// Получение сохраненных профилей
function getSavedProfiles() {
    const profiles = [];

    // Проверяем текущие данные
    if (currentPlayer) {
        profiles.push({
            name: currentPlayer.name,
            profession: currentPlayer.profession,
            balance: currentPlayer.balance,
            player: currentPlayer,
            incomes: incomes,
            expenses: expenses,
            assets: assets,
            liabilities: liabilities
        });
    }

    // Можно добавить логику для множественных профилей
    // Например, хранить в localStorage под разными ключами

    return profiles;
}

// Автоматическое сохранение при закрытии страницы
window.addEventListener('beforeunload', (event) => {
    if (currentPlayer) {
        saveToStorage();
        console.log('Game data auto-saved');
    }
});

// Восстановление при загрузке страницы
function initializeGame() {
    const saved = localStorage.getItem('cashflow_game_data');
    if (saved) {
        try {
            const gameData = JSON.parse(saved);

            if (gameData.currentPlayer) {
                // Показываем диалог восстановления
                const shouldRestore = confirm(`Восстановить предыдущую сессию игрока "${gameData.currentPlayer.name}"?`);

                if (shouldRestore) {
                    // Восстанавливаем данные
                    currentPlayer = gameData.currentPlayer;
                    incomes = gameData.incomes || [];
                    expenses = gameData.expenses || [];
                    assets = gameData.assets || [];
                    liabilities = gameData.liabilities || [];
                    currentRole = gameData.currentRole || '';
                    currentRoomId = gameData.currentRoomId || null;
                    players = new Map(gameData.players || []);

                    // Показываем игровой интерфейс
                    document.getElementById('roleSelection').style.display = 'none';
                    document.getElementById('registrationForm').style.display = 'none';
                    document.getElementById('gameInterface').style.display = 'block';

                    // Обновляем интерфейс
                    document.getElementById('displayName').textContent = currentPlayer.name;
                    document.getElementById('displayProfession').textContent = currentPlayer.profession;
                    document.getElementById('displayBalance').textContent = '$' + currentPlayer.balance.toLocaleString();

                    renderIncomes();
                    renderExpenses();
                    renderAssets();
                    renderLiabilities();
                    updateSalarySummary();
                    updateUI();

                    // Показываем соответствующую панель
                    if (currentRole === 'banker') {
                        document.getElementById('bankerPanel').style.display = 'block';
                    } else {
                        document.getElementById('playerPanel').style.display = 'block';
                    }

                    showNotification(`Добро пожаловать назад, ${currentPlayer.name}!`, 'success');
                    return true;
                } else {
                    // Пользователь не хочет восстанавливать - очищаем сохраненные данные
                    localStorage.removeItem('cashflow_game_data');
                }
            }
        } catch (error) {
            console.error('Error restoring game:', error);
        }
    }
    return false;
}

// Обновляем обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    // Пытаемся восстановить сессию
    const restored = initializeGame();

    if (!restored) {
        // Показываем обычный экран выбора роли
        document.getElementById('roleSelection').style.display = 'block';
    }

    // Остальные обработчики...
    window.onclick = function (event) {
        const modals = document.getElementsByClassName('modal');
        for (let modal of modals) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
    };
});