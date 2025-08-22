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
        this.askedQuestions = new Set();
        this.positiveAnswers = new Set();
        this.rejectedFilms = new Set(); // Запоминаем отвергнутые фильмы
        this.init();
    }
    
    async init() {
        await this.loadDatabase();
        this.isLoading = false;
    }
    
    async loadDatabase() {
        try {
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
        
        if (this.positiveAnswers.size > 0) {
            const positiveAttributes = Array.from(this.positiveAnswers);
            
            for (const attribute of attributes) {
                if (!this.current_answers.hasOwnProperty(attribute) && !this.askedQuestions.has(attribute)) {
                    let correlationScore = 0;
                    
                    for (const positiveAttr of positiveAttributes) {
                        const filmsWithBoth = this.database.filter(film => 
                            film.attributes[positiveAttr] && film.attributes[attribute] && !this.rejectedFilms.has(film.title)
                        ).length;
                        
                        if (filmsWithBoth > 0) {
                            correlationScore += filmsWithBoth;
                        }
                    }
                    
                    const baseGain = this.calculate_information_gain(attribute);
                    const totalGain = baseGain + (correlationScore * 0.1);
                    
                    if (totalGain > best_gain) {
                        best_gain = totalGain;
                        best_attribute = attribute;
                    }
                }
            }
        }
        
        if (!best_attribute) {
            for (const attribute of attributes) {
                if (!this.current_answers.hasOwnProperty(attribute) && !this.askedQuestions.has(attribute)) {
                    const gain = this.calculate_information_gain(attribute);
                    if (gain > best_gain) {
                        best_gain = gain;
                        best_attribute = attribute;
                    }
                }
            }
        }
        
        if (!best_attribute && this.askedQuestions.size > 0) {
            this.askedQuestions.clear();
            return this.choose_best_question();
        }
        
        console.log('Выбран вопрос:', best_attribute, 'с gain:', best_gain);
        return best_attribute;
    }
    
    filter_films() {
        if (!this.database.length) return [];
        
        const scoredFilms = this.database
            .filter(film => !this.rejectedFilms.has(film.title)) // Исключаем отвергнутые фильмы
            .map(film => {
                let match_score = 0;
                let total_weight = 0;
                
                for (const [attribute, user_answer] of Object.entries(this.current_answers)) {
                    if (user_answer === 0) continue;
                    
                    if (film.attributes.hasOwnProperty(attribute)) {
                        const film_value = this.attribute_to_numeric(film, attribute);
                        
                        let similarity = 0;
                        if (user_answer > 0 && film_value > 0) {
                            similarity = 0.9 + (user_answer * 0.1);
                        } else if (user_answer < 0 && film_value < 0) {
                            similarity = 0.9 + (Math.abs(user_answer) * 0.1);
                        } else if (user_answer !== 0) {
                            similarity = 0.2 - Math.abs(user_answer - film_value) / 5;
                        }
                        
                        match_score += similarity;
                        total_weight += 1;
                    } else if (user_answer > 0) {
                        match_score -= 0.2;
                        total_weight += 0.2;
                    } else if (user_answer < 0) {
                        match_score += 0.2 * user_answer;
                        total_weight += 0.2;
                    }
                }
                
                const positiveBonus = Array.from(this.positiveAnswers).filter(attr => 
                    film.attributes[attr]
                ).length * 0.1;
                
                const final_score = total_weight > 0 ? 
                    (match_score / total_weight) + positiveBonus : 
                    0.5 + positiveBonus;
                
                return {
                    ...film,
                    match_score: Math.max(0, Math.min(1, final_score))
                };
            });
        
        return scoredFilms.sort((a, b) => b.match_score - a.match_score);
    }
    
    getTopCandidates(limit = 10) {
        const candidates = this.filter_films();
        return candidates.filter(film => film.match_score >= 0.01).slice(0, limit);
    }
    
    shouldMakeGuess() {
        const candidates = this.filter_films();
        if (candidates.length === 0) return false;
        
        const bestCandidate = candidates[0];
        const meaningfulAnswers = Object.values(this.current_answers).filter(a => a !== 0).length;
        
        console.log('Статистика для угадывания:', {
            meaningfulAnswers,
            bestScore: bestCandidate.match_score,
            candidatesCount: candidates.length,
            rejectedCount: this.rejectedFilms.size,
            topCandidates: candidates.slice(0, 3).map(f => `${f.title}: ${f.match_score.toFixed(2)}`)
        });
        
        if (meaningfulAnswers < 8) return false;
        
        if (bestCandidate.match_score > 0.7 && meaningfulAnswers >= 8) return true;
        
        if (meaningfulAnswers >= 20) return true;
        
        if (candidates.length <= 2 && meaningfulAnswers >= 10) return true;
        
        return false;
    }
    
    // Добавляем фильм в список отвергнутых
    rejectFilm(filmTitle) {
        this.rejectedFilms.add(filmTitle);
        console.log('Фильм отвергнут:', filmTitle, 'Всего отвергнуто:', this.rejectedFilms.size);
    }
    
    // Сброс состояния для новой игры
    resetGameState() {
        this.current_answers = {};
        this.askedQuestions.clear();
        this.positiveAnswers.clear();
        this.rejectedFilms.clear(); // Очищаем список отвергнутых
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
    akinator.resetGameState();
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
    const progress = Math.min((questionsCount / 30) * 100, 100);
    document.getElementById('progressBar').style.width = progress + '%';
    
    const answerValue = akinator.possible_answers[answer];
    akinator.current_answers[currentQuestion] = answerValue;
    akinator.askedQuestions.add(currentQuestion);
    
    if (answerValue > 0) {
        akinator.positiveAnswers.add(currentQuestion);
    }
    
    console.log('Ответ:', answer, 'на вопрос:', currentQuestion);
    console.log('Положительные атрибуты:', Array.from(akinator.positiveAnswers));
    
    if (akinator.shouldMakeGuess()) {
        const candidates = akinator.filter_films();
        const bestCandidate = candidates[0];
        
        if (bestCandidate && bestCandidate.match_score > 0.5) {
            showGuess(bestCandidate.title);
        } else {
            showFilmOptions(candidates);
        }
    } else if (questionsCount >= 30) {
        const candidates = akinator.filter_films();
        showFilmOptions(candidates);
    } else {
        showQuestion();
    }
}

function showGuess(filmTitle) {
    const bestCandidate = akinator.filter_films()[0];
    const meaningfulAnswers = Object.values(akinator.current_answers).filter(a => a !== 0).length;
    
    document.getElementById('guessResult').innerHTML = 
        `<h3>🎉 Я думаю, это: ${filmTitle}</h3>
         <p>Уверенность: ${Math.round(bestCandidate.match_score * 100)}%</p>
         <p>На основе ${meaningfulAnswers} ответов</p>`;
    document.getElementById('guessButtons').style.display = 'block';
    document.getElementById('filmOptions').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
}

function showFilmOptions(candidates) {
    const topCandidates = akinator.getTopCandidates();
    const meaningfulAnswers = Object.values(akinator.current_answers).filter(a => a !== 0).length;
    
    if (topCandidates.length === 0) {
        document.getElementById('guessResult').innerHTML = 
            `<h3>🤔 Нужно больше информации</h3>
             <p>Ответьте на еще несколько вопросов</p>`;
        document.getElementById('filmOptions').style.display = 'none';
        document.getElementById('guessButtons').style.display = 'none';
        
        setTimeout(() => {
            continueGame();
        }, 2000);
    } else {
        document.getElementById('guessResult').innerHTML = 
            `<h3>📋 Наиболее вероятные варианты:</h3>
             <p>На основе ${meaningfulAnswers} ответов</p>`;
        
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
        // Запоминаем отвергнутый фильм
        const guessedFilm = document.getElementById('guessResult').textContent.match(/Я думаю, это: (.+?)$/m);
        if (guessedFilm && guessedFilm[1]) {
            akinator.rejectFilm(guessedFilm[1].trim());
        }
        
        document.getElementById('guessResult').innerHTML = 
            '<h3>😔 Не угадал. Продолжим поиск!</h3>';
        setTimeout(() => {
            continueGame();
        }, 1500);
    }
}

function endGame() {
    document.getElementById('guessResult').innerHTML = 
        '<h3>🔍 Нужно больше информации</h3><p>Давайте продолжим вопросы</p>';
    document.getElementById('filmOptions').style.display = 'none';
    document.getElementById('guessButtons').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
    
    setTimeout(() => {
        continueGame();
    }, 2000);
}

function resetGame() {
    akinator.resetGameState();
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('questionText').textContent = 'Готовы начать игру? Загадайте фильм, а я попробую угадать его!';
}

// ... остальные функции без изменений (renderAttributesGrid, addNewAttribute, addFilmToDatabase, updateStats, displayFilmsList, searchFilms, exportDatabase, downloadDatabase, importDatabase, resetDatabase) ...

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
