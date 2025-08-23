// База данных жанров
const genres = [
    { id: 'action', name: "Боевик", image: "https://cdn-icons-png.flaticon.com/512/4237/4237000.png" },
    { id: 'comedy', name: "Комедия", image: "https://cdn-icons-png.flaticon.com/512/4237/4237000.png" },
    { id: 'drama', name: "Драма", image: "https://cdn-icons-png.flaticon.com/512/4237/4237000.png" },
    { id: 'horror', name: "Ужасы", image: "https://cdn-icons-png.flaticon.com/512/4237/4237000.png" },
    { id: 'cartoon', name: "Мультфильм", image: "https://cdn-icons-png.flaticon.com/512/4237/4237000.png" }
];

// База данных фильмов
let movies = JSON.parse(localStorage.getItem('movies')) || [];

// Текущая сессия
let session = {
    availableGenres: [...genres],
    excludedGenres: [],
    availableMovies: [],
    excludedMovies: [],
    selectedGenre: null
};

// Элементы DOM
const genreStep = document.getElementById('genreStep');
const movieStep = document.getElementById('movieStep');
const genreSelection = document.getElementById('genreSelection');
const movieSelection = document.getElementById('movieSelection');
const finalResult = document.getElementById('finalResult');
const genreWheel = document.getElementById('genreWheel');
const movieWheel = document.getElementById('movieWheel');
const excludedGenres = document.getElementById('excludedGenres');
const excludedMovies = document.getElementById('excludedMovies');
const excludeGenreButton = document.getElementById('excludeGenreButton');
const confirmGenreButton = document.getElementById('confirmGenreButton');
const excludeMovieButton = document.getElementById('excludeMovieButton');
const confirmMovieButton = document.getElementById('confirmMovieButton');
const restartButton = document.getElementById('restartButton');
const selectedGenreName = document.getElementById('selectedGenreName');
const finalTitle = document.getElementById('finalTitle');
const finalPoster = document.getElementById('finalPoster');
const movieCards = document.getElementById('movieCards');
const addMovieForm = document.getElementById('addMovieForm');
const genreSelect = document.getElementById('genre');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const exportButton = document.getElementById('exportButton');
const importButton = document.getElementById('importButton');
const importFile = document.getElementById('importFile');
const importConfirmButton = document.getElementById('importConfirmButton');
const resetButton = document.getElementById('resetButton');
const fileName = document.getElementById('fileName');

// Инициализация вкладок
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        
        // Активируем выбранную вкладку
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${tab}Tab`).classList.add('active');
    });
});

// Заполняем выпадающий список жанров
function initializeGenreSelect() {
    genreSelect.innerHTML = '<option value="">Выберите жанр</option>';
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        genreSelect.appendChild(option);
    });
}

// Заполняем рулетку жанров
function initializeGenreWheel() {
    genreWheel.innerHTML = '';
    
    if (session.availableGenres.length === 0) {
        genreWheel.innerHTML = '<div class="empty-state">Все жанры исключены</div>';
        return;
    }
    
    // Добавляем жанры в рулетку (несколько копий для плавной анимации)
    for (let i = 0; i < 3; i++) {
        session.availableGenres.forEach(genre => {
            const genreElement = document.createElement('div');
            genreElement.className = 'genre';
            genreElement.dataset.id = genre.id;
            
            const img = document.createElement('img');
            img.className = 'genre-image';
            img.src = genre.image;
            img.alt = genre.name;
            
            genreElement.appendChild(img);
            genreWheel.appendChild(genreElement);
        });
    }
    
    // Центрируем первый элемент под указателем
    centerFirstItem(genreWheel);
}

// Заполняем рулетку фильмов
function initializeMovieWheel() {
    movieWheel.innerHTML = '';
    
    if (session.availableMovies.length === 0) {
        movieWheel.innerHTML = '<div class="empty-state">Нет фильмов в выбранном жанре</div>';
        return;
    }
    
    // Добавляем фильмы в рулетку (несколько копий для плавной анимации)
    for (let i = 0; i < 3; i++) {
        session.availableMovies.forEach(movie => {
            const movieElement = document.createElement('div');
            movieElement.className = 'movie';
            movieElement.dataset.id = movie.id;
            
            const img = document.createElement('img');
            img.className = 'movie-poster';
            img.src = movie.poster;
            img.alt = movie.title;
            
            movieElement.appendChild(img);
            movieWheel.appendChild(movieElement);
        });
    }
    
    // Центрируем первый элемент под указателем
    centerFirstItem(movieWheel);
}

// Центрирует первый элемент под указателем
function centerFirstItem(wheel) {
    const itemWidth = 200;
    const containerWidth = wheel.parentElement.offsetWidth;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    
    wheel.style.transition = 'none';
    wheel.style.left = centerOffset + 'px';
    
    // Принудительное применение стилей
    setTimeout(() => {
        wheel.style.transition = '';
    }, 50);
}

// Обновление списка исключенных жанров
function updateExcludedGenres() {
    excludedGenres.innerHTML = '';
    
    if (session.excludedGenres.length === 0) {
        excludedGenres.innerHTML = '<div class="empty-state">Нет исключенных жанров</div>';
        return;
    }
    
    session.excludedGenres.forEach(genre => {
        const item = document.createElement('div');
        item.className = 'excluded-item';
        item.textContent = genre.name;
        excludedGenres.appendChild(item);
    });
}

// Обновление списка исключенных фильмов
function updateExcludedMovies() {
    excludedMovies.innerHTML = '';
    
    if (session.excludedMovies.length === 0) {
        excludedMovies.innerHTML = '<div class="empty-state">Нет исключенных фильмов</div>';
        return;
    }
    
    session.excludedMovies.forEach(movie => {
        const item = document.createElement('div');
        item.className = 'excluded-item';
        item.textContent = movie.title;
        excludedMovies.appendChild(item);
    });
}

// Обновление карточек фильмов
function updateMovieCards() {
    movieCards.innerHTML = '';
    
    if (movies.length === 0) {
        movieCards.innerHTML = '<div class="empty-state">Вы еще не добавили ни одного фильма</div>';
        return;
    }
    
    movies.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        
        const img = document.createElement('img');
        img.src = movie.poster;
        img.alt = movie.title;
        
        const title = document.createElement('h3');
        title.textContent = movie.title;
        
        const genre = document.createElement('div');
        genre.className = 'genre';
        genre.textContent = genres.find(g => g.id === movie.genre)?.name;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMovie(index);
        });
        
        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(genre);
        card.appendChild(deleteButton);
        movieCards.appendChild(card);
    });
}

// Удаление фильма
function deleteMovie(index) {
    if (confirm(`Удалить фильм "${movies[index].title}" из списка?`)) {
        movies.splice(index, 1);
        saveMovies();
        updateMovieCards();
    }
}

// Сохранение фильмов в localStorage
function saveMovies() {
    localStorage.setItem('movies', JSON.stringify(movies));
}

// Исключение жанра
function excludeGenre() {
    if (session.availableGenres.length <= 1) return;
    
    // Блокируем кнопку на время анимации
    excludeGenreButton.disabled = true;
    
    // Вычисляем случайное смещение
    const itemWidth = 200;
    const containerWidth = genreWheel.parentElement.offsetWidth;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    const extraSpins = 2;
    const randomIndex = Math.floor(Math.random() * session.availableGenres.length);
    const targetPosition = centerOffset - (randomIndex * itemWidth + extraSpins * session.availableGenres.length * itemWidth);
    
    // Анимируем прокрутку
    genreWheel.style.transition = 'left 3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    genreWheel.style.left = targetPosition + 'px';
    
    // После завершения анимации
    setTimeout(() => {
        // Исключаем выбранный жанр
        const excludedGenre = session.availableGenres.splice(randomIndex, 1)[0];
        session.excludedGenres.push(excludedGenre);
        
        // Обновляем отображение
        initializeGenreWheel();
        updateExcludedGenres();
        
        // Активируем кнопку подтверждения, если остался один жанр
        if (session.availableGenres.length === 1) {
            confirmGenreButton.disabled = false;
        }
        
        // Разблокируем кнопку
        excludeGenreButton.disabled = false;
    }, 3000);
}

// Подтверждение выбора жанра
function confirmGenre() {
    if (session.availableGenres.length !== 1) return;
    
    session.selectedGenre = session.availableGenres[0];
    
    // Обновляем отображение
    selectedGenreName.textContent = session.selectedGenre.name;
    genreStep.classList.remove('active');
    movieStep.classList.add('active');
    genreSelection.style.display = 'none';
    movieSelection.style.display = 'block';
    
    // Загружаем фильмы выбранного жанра
    session.availableMovies = movies
        .filter(movie => movie.genre === session.selectedGenre.id)
        .map((movie, index) => ({ ...movie, id: index }));
    
    // Инициализируем рулетку фильмов
    initializeMovieWheel();
    updateExcludedMovies();
    
    // Активируем кнопку исключения фильмов
    excludeMovieButton.disabled = false;
}

// Исключение фильма
function excludeMovie() {
    if (session.availableMovies.length <= 1) return;
    
    // Блокируем кнопку на время анимации
    excludeMovieButton.disabled = true;
    
    // Вычисляем случайное смещение
    const itemWidth = 200;
    const containerWidth = movieWheel.parentElement.offsetWidth;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    const extraSpins = 2;
    const randomIndex = Math.floor(Math.random() * session.availableMovies.length);
    const targetPosition = centerOffset - (randomIndex * itemWidth + extraSpins * session.availableMovies.length * itemWidth);
    
    // Анимируем прокрутку
    movieWheel.style.transition = 'left 3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    movieWheel.style.left = targetPosition + 'px';
    
    // После завершения анимации
    setTimeout(() => {
        // Исключаем выбранный фильм
        const excludedMovie = session.availableMovies.splice(randomIndex, 1)[0];
        session.excludedMovies.push(excludedMovie);
        
        // Обновляем отображение
        initializeMovieWheel();
        updateExcludedMovies();
        
        // Активируем кнопку подтверждения, если остался один фильм
        if (session.availableMovies.length === 1) {
            confirmMovieButton.disabled = false;
        }
        
        // Разблокируем кнопку
        excludeMovieButton.disabled = false;
    }, 3000);
}

// Подтверждение выбора фильма
function confirmMovie() {
    if (session.availableMovies.length !== 1) return;
    
    const selectedMovie = session.availableMovies[0];
    
    // Показываем результат
    finalTitle.textContent = selectedMovie.title;
    finalPoster.src = selectedMovie.poster;
    finalPoster.alt = selectedMovie.title;
    
    movieSelection.style.display = 'none';
    finalResult.style.display = 'block';
}

// Перезапуск процесса выбора
function restartSelection() {
    // Сбрасываем сессию
    session = {
        availableGenres: [...genres],
        excludedGenres: [],
        availableMovies: [],
        excludedMovies: [],
        selectedGenre: null
    };
    
    // Сбрасываем отображение
    genreStep.classList.add('active');
    movieStep.classList.remove('active');
    genreSelection.style.display = 'block';
    movieSelection.style.display = 'none';
    finalResult.style.display = 'none';
    
    confirmGenreButton.disabled = true;
    excludeMovieButton.disabled = true;
    confirmMovieButton.disabled = true;
    
    // Переинициализируем рулетки
    initializeGenreWheel();
    initializeMovieWheel();
    updateExcludedGenres();
    updateExcludedMovies();
}

// Экспорт данных
function exportData() {
    const data = JSON.stringify(movies, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movies_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Импорт данных
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedMovies = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedMovies)) {
                throw new Error('Invalid file format');
            }
            
            // Проверяем структуру данных
            const isValid = importedMovies.every(movie => 
                movie && typeof movie.title === 'string' && 
                typeof movie.poster === 'string' && 
                typeof movie.genre === 'string'
            );
            
            if (!isValid) {
                throw new Error('Invalid movie data structure');
            }
            
            // Подтверждаем импорт
            importConfirmButton.style.display = 'block';
            importConfirmButton.onclick = function() {
                movies = importedMovies;
                saveMovies();
                updateMovieCards();
                alert('Данные успешно импортированы!');
                
                // Сбрасываем форму
                importConfirmButton.style.display = 'none';
                fileName.textContent = '';
                importFile.value = '';
            };
        } catch (error) {
            alert('Ошибка при импорте файла: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Сброс данных
function resetData() {
    if (confirm('Вы уверены, что хотите удалить все фильмы? Это действие нельзя отменить.')) {
        movies = [];
        saveMovies();
        updateMovieCards();
        alert('Все данные удалены!');
    }
}

// Добавление нового фильма
addMovieForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const titleInput = document.getElementById('title');
    const posterInput = document.getElementById('poster');
    const genreInput = document.getElementById('genre');
    
    const newMovie = {
        title: titleInput.value.trim(),
        poster: posterInput.value.trim(),
        genre: genreInput.value
    };
    
    // Проверяем, не добавлен ли уже такой фильм
    const isDuplicate = movies.some(movie => 
        movie.title.toLowerCase() === newMovie.title.toLowerCase() || 
        movie.poster === newMovie.poster
    );
    
    if (isDuplicate) {
        alert('Этот фильм уже есть в списке!');
        return;
    }
    
    movies.push(newMovie);
    saveMovies();
    
    // Очищаем форму
    titleInput.value = '';
    posterInput.value = '';
    genreInput.value = '';
    
    // Обновляем отображение
    updateMovieCards();
    
    alert('Фильм успешно добавлен!');
});

// Инициализация при загрузке страницы
window.onload = function() {
    initializeGenreSelect();
    initializeGenreWheel();
    updateExcludedGenres();
    updateMovieCards();
    
    // Назначаем обработчики событий
    excludeGenreButton.addEventListener('click', excludeGenre);
    confirmGenreButton.addEventListener('click', confirmGenre);
    excludeMovieButton.addEventListener('click', excludeMovie);
    confirmMovieButton.addEventListener('click', confirmMovie);
    restartButton.addEventListener('click', restartSelection);
    exportButton.addEventListener('click', exportData);
    importButton.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileName.textContent = `Выбран файл: ${e.target.files[0].name}`;
            importData(e.target.files[0]);
        }
    });
    resetButton.addEventListener('click', resetData);
    
    // Предзагрузка изображений для рулетки
    genres.forEach(genre => {
        const img = new Image();
        img.src = genre.image;
    });
    
    if (movies.length > 0) {
        movies.forEach(movie => {
            const img = new Image();
            img.src = movie.poster;
        });
    }
};
