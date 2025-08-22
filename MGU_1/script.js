// Основной класс приложения
class FilmAkinator {
    constructor() {
        this.database = [];
        this.attributes = new Set();
        this.current_answers = {};
        this.possible_answers = {
            "да": 1, "скорее да": 0.7, "не знаю": 0, 
            "скорее нет": -0.7, "нет": -1
        };
        this.isLoading = true;
        this.init();
    }
    
    async init() {
        await this.loadDatabase();
        this.isLoading = false;
    }
    
    async loadDatabase() {
        try {
            // Пытаемся загрузить внешнюю базу сначала
            try {
                const response = await fetch('films_database.json');
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        this.database = data;
                        console.log('Внешняя база загружена:', this.database.length, 'фильмов');
                        this.saveToLocalStorage();
                        this.updateAttributes();
                        return;
                    }
                }
            } catch (e) {
                console.log('Внешняя база не найдена, пробуем локальную');
            }
            
            // Если внешней нет, пробуем локальную
            const saved = localStorage.getItem('filmDatabase');
            if (saved) {
                this.database = JSON.parse(saved);
                console.log('Локальная база загружена:', this.database.length, 'фильмов');
            } else {
                await this.loadDefaultDatabase();
            }
            
            this.updateAttributes();
        } catch (e) {
            console.error('Ошибка загрузки базы:', e);
            await this.loadDefaultDatabase();
        }
    }
    
    async loadDefaultDatabase() {
        this.database = [
            {
                "title": "Крестный отец",
                "attributes": {
                    "страна_США": true, "год_1972": true, "жанр_криминал": true,
                    "режиссер_Коппола": true, "актер_Брандо": true,
                    "компания_Paramount": true, "основан_на_книге": true,
                    "премия_Оскар": true, "сиквелы": true, "мафия": true
                }
            },
            {
                "title": "Титаник",
                "attributes": {
                    "страна_США": true, "год_1997": true, "жанр_мелодрама": true,
                    "режиссер_Кэмерон": true, "актер_ДиКаприо": true,
                    "компания_Fox": true, "основан_на_реальных_событиях": true,
                    "премия_Оскар": true, "корабль": true, "катастрофа": true
                }
            }
        ];
        this.saveToLocalStorage();
        console.log('Загружена база по умолчанию');
    }
    
    updateAttributes() {
        this.attributes.clear();
        this.database.forEach(film => {
            Object.keys(film.attributes).forEach(attr => this.attributes.add(attr));
        });
    }
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('filmDatabase', JSON.stringify(this.database));
        } catch (e) {
            console.warn('Не удалось сохранить в localStorage:', e);
        }
    }
    
    async addFilm(title, selectedAttributes) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const attributes = {};
                    selectedAttributes.forEach(attr => {
                        attributes[attr] = true;
                    });
                    
                    const newFilm = {
                        title: title.trim(),
                        attributes: attributes
                    };
                    
                    this.database.push(newFilm);
                    this.updateAttributes();
                    this.saveToLocalStorage();
                    
                    console.log('Фильм добавлен:', newFilm);
                    resolve(true);
                } catch (e) {
                    console.error('Ошибка добавления фильма:', e);
                    resolve(false);
                }
            }, 100);
        });
    }
    
    deleteFilm(index) {
        if (index >= 0 && index < this.database.length) {
            this.database.splice(index, 1);
            this.updateAttributes();
            this.saveToLocalStorage();
            return true;
        }
        return false;
    }
    
    get_all_attributes() {
        return Array.from(this.attributes).sort();
    }
    
    attribute_to_numeric(film, attribute) {
        const value = film.attributes[attribute];
        return value ? 1 : -1;
    }
    
    calculate_information_gain(attribute) {
        if (!this.database.length) return 0;
        
        const values = this.database.map(film => 
            this.attribute_to_numeric(film, attribute)
        );
        
        if (new Set(values).size === 1) return 0;
        
        const counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        
        let entropy = 0;
        const total = values.length;
        
        for (const count of Object.values(counts)) {
            const p = count / total;
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        
        return entropy;
    }
    
    choose_best_question() {
        if (!this.database.length) {
            console.log('База данных пуста');
            return null;
        }
        
        const attributes = this.get_all_attributes();
        let best_attribute = null;
        let best_gain = -1;
        
        for (const attribute of attributes) {
            if (!this.current_answers.hasOwnProperty(attribute)) {
                const gain = this.calculate_information_gain(attribute);
                if (gain > best_gain) {
                    best_gain = gain;
                    best_attribute = attribute;
                }
            }
        }
        
        console.log('Выбран вопрос:', best_attribute, 'с gain:', best_gain);
        return best_attribute;
    }
    
    filter_films() {
        if (!this.database.length) return [];
        
        const scoredFilms = this.database.map(film => {
            let match_score = 0;
            let total_weight = 0;
            let answered_attributes = 0;
            
            for (const [attribute, user_answer] of Object.entries(this.current_answers)) {
                answered_attributes++;
                
                // Пропускаем ответы "не знаю"
                if (user_answer === 0) continue;
                
                if (film.attributes.hasOwnProperty(attribute)) {
                    const film_value = this.attribute_to_numeric(film, attribute);
                    
                    // Более мягкое сравнение с учетом "скорее да/нет"
                    let similarity = 0;
                    if (user_answer > 0 && film_value > 0) {
                        similarity = 0.8 + (user_answer * 0.2);
                    } else if (user_answer < 0 && film_value < 0) {
                        similarity = 0.8 + (Math.abs(user_answer) * 0.2);
                    } else if (user_answer !== 0) {
                        similarity = 0.3 - Math.abs(user_answer - film_value) / 4;
                    }
                    
                    match_score += similarity;
                    total_weight += 1;
                } else if (user_answer > 0) {
                    // Если пользователь сказал "да", но у фильма нет атрибута - небольшой штраф
                    match_score -= 0.3 * user_answer;
                    total_weight += 0.3;
                } else if (user_answer < 0) {
                    // Если пользователь сказал "нет", но у фильма есть атрибут - небольшой штраф
                    match_score += 0.3 * user_answer;
                    total_weight += 0.3;
                }
            }
            
            // Учитываем количество отвеченных атрибутов
            const answer_ratio = answered_attributes > 0 ? 
                (Object.keys(this.current_answers).filter(attr => this.current_answers[attr] !== 0).length / answered_attributes) : 1;
            
            const final_score = total_weight > 0 ? 
                (match_score / total_weight) * Math.max(0.5, answer_ratio) : 
                0.5;
            
            return {
                ...film,
                match_score: Math.max(0, Math.min(1, final_score))
            };
        });
        
        return scoredFilms.sort((a, b) => b.match_score - a.match_score);
    }
    
    getTopCandidates(limit = 8) {
        const candidates = this.filter_films();
        // Возвращаем больше кандидатов с более низким порогом
        return candidates.filter(film => film.match_score >= 0.05).slice(0, limit);
    }
    
    shouldMakeGuess() {
        const candidates = this.filter_films();
        if (candidates.length === 0) return false;
        
        const bestCandidate = candidates[0];
        const answeredQuestions = Object.keys(this.current_answers).length;
        const meaningfulAnswers = Object.values(this.current_answers).filter(a => a !== 0).length;
        
        console.log('Статистика:', {
            answeredQuestions,
            meaningfulAnswers,
            bestScore: bestCandidate.match_score,
            candidates: candidates.length
        });
        
        // Делаем предположение только после достаточного количества осмысленных ответов
        if (meaningfulAnswers < 5) return false;
        
        // Если есть явный лидер с высоким score
        if (bestCandidate.match_score > 0.8) return true;
        
        // Если задано много вопросов
        if (meaningfulAnswers >= 15) return true;
        
        // Если осталось мало кандидатов
        if (candidates.length <= 3 && meaningfulAnswers >= 8) return true;
        
        return false;
    }
}

// Глобальные переменные
let akinator = new FilmAkinator();
let currentQuestion = null;
let selectedAttributes = new Set();
let questionsCount = 0;

// Ожидание загрузки базы
async function waitForDatabase() {
    while (akinator.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Функции интерфейса
async function showSection(sectionId) {
    await waitForDatabase();
    
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`.tab[onclick="showSection('${sectionId}')"]`).classList.add('active');
    
    if (sectionId === 'database') {
        displayFilmsList();
    } else if (sectionId === 'admin') {
        renderAttributesGrid();
        updateStats();
    }
}

function startGame() {
    akinator.current_answers = {};
    questionsCount = 0;
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('answers').style.display = 'grid';
    document.getElementById('result').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    showQuestion();
}

function showQuestion() {
    currentQuestion = akinator.choose_best_question();
    
    if (!currentQuestion) {
        endGame();
        return;
    }
    
    let questionText = currentQuestion;
    if (questionText.includes('_')) {
        const parts = questionText.split('_');
        const mainPart = parts[0];
        const valuePart = parts.slice(1).join(' ');
        
        switch(mainPart) {
            case 'страна':
                questionText = `Фильм снят в ${valuePart}?`;
                break;
            case 'год':
                questionText = `Фильм вышел в ${valuePart} году?`;
                break;
            case 'жанр':
                questionText = `Это фильм в жанре ${valuePart}?`;
                break;
            case 'режиссер':
                questionText = `Фильм снял ${valuePart}?`;
                break;
            case 'актер':
                questionText = `В главной роли ${valuePart}?`;
                break;
            case 'компания':
                questionText = `Фильм выпустила компания ${valuePart}?`;
                break;
            default:
                questionText = `Фильм связан с "${questionText.replace(/_/g, ' ')}"?`;
        }
    } else {
        questionText = `Фильм связан с "${questionText}"?`;
    }
    
    document.getElementById('questionText').textContent = questionText;
    console.log('Задан вопрос:', currentQuestion, 'Ответов:', Object.keys(akinator.current_answers).length);
}

function answerQuestion(answer) {
    if (!currentQuestion) return;
    
    questionsCount++;
    const progress = Math.min((questionsCount / 25) * 100, 100);
    document.getElementById('progressBar').style.width = progress + '%';
    
    akinator.current_answers[currentQuestion] = akinator.possible_answers[answer];
    console.log('Ответ:', answer, 'на вопрос:', currentQuestion);
    
    // Всегда показываем следующий вопрос, кроме случаев когда нужно сделать предположение
    if (akinator.shouldMakeGuess()) {
        const candidates = akinator.filter_films();
        const bestCandidate = candidates[0];
        
        if (bestCandidate && bestCandidate.match_score > 0.6) {
            showGuess(bestCandidate.title);
        } else {
            // Если нет явного лидера, но нужно сделать предположение - показываем варианты
            showFilmOptions(candidates);
        }
    } else if (questionsCount >= 25) {
        // Максимальное количество вопросов
        const candidates = akinator.filter_films();
        showFilmOptions(candidates);
    } else {
        // Продолжаем задавать вопросы
        showQuestion();
    }
}

function showGuess(filmTitle) {
    const bestCandidate = akinator.filter_films()[0];
    document.getElementById('guessResult').innerHTML = 
        `<h3>🎉 Я думаю, это: ${filmTitle}</h3>
         <p>Вероятность: ${Math.round(bestCandidate.match_score * 100)}%</p>
         <p>На основе ${Object.values(akinator.current_answers).filter(a => a !== 0).length} ответов</p>`;
    document.getElementById('guessButtons').style.display = 'block';
    document.getElementById('filmOptions').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
}

function showFilmOptions(candidates) {
    const topCandidates = akinator.getTopCandidates();
    
    if (topCandidates.length === 0) {
        document.getElementById('guessResult').innerHTML = 
            `<h3>😔 Не могу угадать фильм</h3>
             <p>Попробуйте ответить на больше вопросов или добавьте фильм в базу</p>`;
        document.getElementById('filmOptions').style.display = 'none';
        document.getElementById('guessButtons').style.display = 'none';
    } else {
        document.getElementById('guessResult').innerHTML = 
            `<h3>📋 Возможные варианты:</h3>
             <p>На основе ${Object.values(akinator.current_answers).filter(a => a !== 0).length} ответов</p>`;
        
        const filmList = document.getElementById('filmList');
        filmList.innerHTML = '';
        
        topCandidates.forEach(film => {
            const li = document.createElement('li');
            li.className = 'film-item';
            li.innerHTML = `
                <strong>${film.title}</strong>
                <br><small>Совпадение: ${Math.round(film.match_score * 100)}%</small>
            `;
            li.onclick = () => confirmFilmGuess(film.title);
            filmList.appendChild(li);
        });
        
        document.getElementById('filmOptions').style.display = 'block';
        document.getElementById('guessButtons').style.display = 'none';
    }
    
    document.getElementById('result').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
}

function confirmFilmGuess(filmTitle) {
    document.getElementById('guessResult').innerHTML = 
        `<h3>🎉 Отлично! Это ${filmTitle}</h3>`;
    document.getElementById('filmOptions').style.display = 'none';
    
    setTimeout(() => {
        if (confirm('Хотите сыграть еще раз?')) {
            startGame();
        }
    }, 1000);
}

function continueGame() {
    document.getElementById('result').style.display = 'none';
    document.getElementById('answers').style.display = 'grid';
    showQuestion();
}

function confirmGuess(isCorrect) {
    if (isCorrect) {
        document.getElementById('guessResult').innerHTML = 
            '<h3>🎉 Ура! Я угадал!</h3>';
        setTimeout(() => {
            if (confirm('Хотите сыграть еще раз?')) {
                startGame();
            }
        }, 1000);
    } else {
        document.getElementById('guessResult').innerHTML = 
            '<h3>😔 Не угадал. Давайте попробуем еще!</h3>';
        setTimeout(() => {
            continueGame();
        }, 1500);
    }
}

function endGame() {
    document.getElementById('questionText').textContent = 'Не могу угадать фильм. Попробуйте добавить больше фильмов в базу!';
    document.getElementById('answers').style.display = 'none';
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('result').style.display = 'none';
}

function resetGame() {
    akinator.current_answers = {};
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('questionText').textContent = 'Готовы начать игру? Загадайте фильм, а я попробую угадать его!';
}

async function renderAttributesGrid() {
    await waitForDatabase();
    
    const grid = document.getElementById('attributesGrid');
    const loading = document.getElementById('loadingAttributes');
    
    if (akinator.attributes.size === 0) {
        loading.innerHTML = 'Нет атрибутов. Добавьте первый фильм!';
        return;
    }
    
    loading.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '';
    
    const allAttributes = akinator.get_all_attributes();
    
    allAttributes.forEach(attr => {
        const div = document.createElement('div');
        div.className = 'attribute-item';
        div.textContent = attr.replace(/_/g, ' ');
        div.onclick = () => toggleAttribute(attr, div);
        
        if (selectedAttributes.has(attr)) {
            div.classList.add('selected');
        }
        
        grid.appendChild(div);
    });
}

function toggleAttribute(attr, element) {
    if (selectedAttributes.has(attr)) {
        selectedAttributes.delete(attr);
        element.classList.remove('selected');
    } else {
        selectedAttributes.add(attr);
        element.classList.add('selected');
    }
}

function addNewAttribute() {
    const newAttrInput = document.getElementById('newAttribute');
    const newAttr = newAttrInput.value.trim();
    
    if (!newAttr) {
        alert('Введите название атрибута!');
        return;
    }
    
    const formattedAttr = newAttr.replace(/\s+/g, '_');
    
    if (!selectedAttributes.has(formattedAttr)) {
        selectedAttributes.add(formattedAttr);
        renderAttributesGrid();
        newAttrInput.value = '';
    }
}

async function addFilmToDatabase() {
    await waitForDatabase();
    
    const titleInput = document.getElementById('newFilmTitle');
    const title = titleInput.value.trim();
    const statusDiv = document.getElementById('addFilmStatus');
    
    if (!title) {
        statusDiv.innerHTML = '<span style="color: var(--danger);">Введите название фильма!</span>';
        return;
    }
    
    if (selectedAttributes.size === 0) {
        statusDiv.innerHTML = '<span style="color: var(--danger);">Выберите хотя бы один атрибут!</span>';
        return;
    }
    
    statusDiv.innerHTML = '<span style="color: var(--secondary);">Добавляем фильм...</span>';
    
    try {
        const success = await akinator.addFilm(title, Array.from(selectedAttributes));
        
        if (success) {
            statusDiv.innerHTML = `<span style="color: var(--success);">Фильм "${title}" успешно добавлен!</span>`;
            titleInput.value = '';
            selectedAttributes.clear();
            renderAttributesGrid();
            updateStats();
            
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        } else {
            statusDiv.innerHTML = '<span style="color: var(--danger);">Ошибка при добавлении фильма!</span>';
        }
    } catch (error) {
        statusDiv.innerHTML = '<span style="color: var(--danger);">Ошибка: ' + error.message + '</span>';
    }
}

function updateStats() {
    document.getElementById('filmsCount').textContent = akinator.database.length;
    document.getElementById('attributesCount').textContent = akinator.attributes.size;
}

async function displayFilmsList() {
    await waitForDatabase();
    
    const list = document.getElementById('filmsList');
    const loading = document.getElementById('loadingFilms');
    
    if (akinator.database.length === 0) {
        loading.innerHTML = 'База фильмов пуста. Добавьте первый фильм!';
        return;
    }
    
    loading.style.display = 'none';
    list.style.display = 'block';
    list.innerHTML = '';
    
    akinator.database.forEach((film, index) => {
        const li = document.createElement('li');
        li.className = 'film-item';
        
        const filmInfo = document.createElement('div');
        filmInfo.innerHTML = `
            <strong>${film.title}</strong>
            <br><small>Атрибутов: ${Object.keys(film.attributes).length}</small>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Удалить фильм "${film.title}"?`)) {
                akinator.deleteFilm(index);
                displayFilmsList();
            }
        };
        
        li.appendChild(filmInfo);
        li.appendChild(deleteBtn);
        list.appendChild(li);
    });
}

function searchFilms() {
    const searchTerm = document.getElementById('searchFilm').value.toLowerCase();
    const items = document.querySelectorAll('.film-item');
    
    items.forEach(item => {
        const filmName = item.querySelector('strong').textContent.toLowerCase();
        if (filmName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function exportDatabase() {
    const dataStr = JSON.stringify(akinator.database, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'films_database.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function downloadDatabase() {
    const data = {
        database: akinator.database,
        lastUpdated: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'films_database_full.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

function importDatabase() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Выберите файл для импорта!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                akinator.database = data;
            } else if (data.database) {
                akinator.database = data.database;
            } else {
                throw new Error('Неверный формат файла');
            }
            
            akinator.saveToLocalStorage();
            akinator.updateAttributes();
            alert('База данных успешно импортирована!');
            fileInput.value = '';
            updateStats();
            displayFilmsList();
            renderAttributesGrid();
        } catch (error) {
            alert('Ошибка при импорте: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function resetDatabase() {
    if (confirm('Восстановить базу данных по умолчанию? Все текущие данные будут потеряны.')) {
        akinator.loadDefaultDatabase();
        updateStats();
        displayFilmsList();
        renderAttributesGrid();
        alert('База данных сброшена к значениям по умолчанию!');
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Приложение инициализируется...');
    
    document.getElementById('loadingAttributes').style.display = 'block';
    document.getElementById('attributesGrid').style.display = 'none';
    document.getElementById('loadingFilms').style.display = 'block';
    document.getElementById('filmsList').style.display = 'none';
    
    await waitForDatabase();
    
    console.log('База загружена, запускаем интерфейс');
    updateStats();
    renderAttributesGrid();
    displayFilmsList();
    
    document.getElementById('loadingAttributes').style.display = 'none';
    document.getElementById('attributesGrid').style.display = 'grid';
});
