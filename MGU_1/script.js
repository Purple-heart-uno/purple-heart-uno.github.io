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
    const progress = Math.min((questionsCount / 20) * 100, 100);
    document.getElementById('progressBar').style.width = progress + '%';
    
    akinator.current_answers[currentQuestion] = akinator.possible_answers[answer];
    console.log('Ответ:', answer, 'на вопрос:', currentQuestion);
    
    if (akinator.shouldMakeGuess()) {
        const candidates = akinator.filter_films();
        const bestCandidate = candidates[0];
        
        if (bestCandidate && bestCandidate.match_score > 0.6) {
            showGuess(bestCandidate.title);
        } else {
            showFilmOptions(candidates);
        }
    } else if (questionsCount >= 20) {
        const candidates = akinator.filter_films();
        showFilmOptions(candidates);
    } else {
        showQuestion();
    }
}

function showGuess(filmTitle) {
    document.getElementById('guessResult').innerHTML = 
        `<h3>🎉 Я думаю, это: ${filmTitle}</h3>
         <p>Вероятность: ${Math.round(akinator.filter_films()[0].match_score * 100)}%</p>`;
    document.getElementById('guessButtons').style.display = 'block';
    document.getElementById('filmOptions').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    document.getElementById('answers').style.display = 'none';
}

function showFilmOptions(candidates) {
    const topCandidates = akinator.getTopCandidates();
    
    if (topCandidates.length === 0) {
        document.getElementById('guessResult').innerHTML = 
            '<h3>😔 Не могу угадать фильм. Возможно, его нет в базе или ответы противоречивы.</h3>';
        document.getElementById('filmOptions').style.display = 'none';
        document.getElementById('guessButtons').style.display = 'none';
    } else {
        document.getElementById('guessResult').innerHTML = 
            '<h3>📋 Возможные варианты:</h3>';
        
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
