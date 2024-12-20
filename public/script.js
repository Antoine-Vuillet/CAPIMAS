//Uitilisation du tag "@module" afin de séparer les fichiers dans la documentation Jsdoc
/**@module script */
const socket = io();

let roomName;
let username; 
const createRoomBtn = document.getElementById('createRoomBtn');
const loadGameBtn = document.getElementById('loadGameBtn');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const playersList = document.getElementById('playersList');
const featureDescription = document.getElementById('featureDescription');
const cards = document.querySelectorAll('.cardBtn');
const resultsDiv = document.getElementById('resultsDiv');
const results = document.getElementById('results');

// Éléments pour la liste des salles disponibles
const availableRoomsList = document.getElementById('availableRoomsList');

// Éléments pour le chat
const chatDiv = document.getElementById('chatDiv');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// Éléments pour le bouton de fin de discussion (pour le créateur)
const forceEndDiscussionBtn = document.createElement('button');
forceEndDiscussionBtn.id = 'forceEndDiscussionBtn';
forceEndDiscussionBtn.textContent = 'Terminer le débat';
forceEndDiscussionBtn.style.display = 'none';
document.body.appendChild(forceEndDiscussionBtn);

// Élément pour afficher le timer
const discussionTimerDisplay = document.createElement('div');
discussionTimerDisplay.id = 'discussionTimer';
discussionTimerDisplay.style.display = 'none';
document.body.appendChild(discussionTimerDisplay);

// Création d'une salle
createRoomBtn.addEventListener('click', () => {
    roomName = document.getElementById('roomNameInput').value;
    const maxPlayers = parseInt(document.getElementById('maxPlayersInput').value);
    username = document.getElementById('usernameInput').value; // Récupération du pseudo
    const gameMode = document.getElementById('gameModeSelect').value;
    const backlogFile = document.getElementById('backlogInput').files[0];

    if (roomName && maxPlayers && username && gameMode && backlogFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const backlog = JSON.parse(event.target.result);
            socket.emit('createRoom', { roomName, maxPlayers, username, gameMode, backlog });
        };
        reader.readAsText(backlogFile);
    } else {
        Swal.fire('Erreur', 'Veuillez remplir tous les champs et sélectionner un fichier backlog.', 'error');
    }
});

// Réception de la confirmation de création de salle
socket.on('roomCreated', roomCreation);

// Réception de la liste des salles disponibles
socket.on('availableRooms', roomsAvailable);

// Confirmation de la jonction de la salle
socket.on('roomJoined', roomJoined);

// Mise à jour de la liste des joueurs dans la salle
socket.on('updatePlayers', updatePlayers);

// Démarrage du vote
socket.on('startVoting', startVote);

// Réception de la difficulté estimée
socket.on('featureEstimated', featureEstimated);

socket.on('showMessage', showMessage);

// Gestion du vote
cards.forEach(card => {
    card.addEventListener('click', () => {
        const vote = card.getAttribute('data-value');
        socket.emit('vote', { roomName, vote });
        console.log(`Vous avez voté : ${vote}`);
        // Désactiver les boutons après le vote
        cards.forEach(btn => btn.disabled = true);
    });
});

// Re-vote en cas de désaccord
socket.on('revote', revote);

// Début de la discussion
socket.on('startDiscussion', startDiscussion);

// Notification que la discussion a commencé
socket.on('discussionStarted', discussionStarted);

// Fonction pour démarrer le timer côté client
let discussionTimerInterval;

/**
 * Démarre le timer pour la discussion pour un vote.
 */
function startDiscussionTimer() {
    let timeLeft = 2 * 60; // 2 minutes en secondes
    discussionTimerDisplay.textContent = `Temps restant pour le débat : ${formatTime(timeLeft)}`;
    discussionTimerInterval = setInterval(() => {
        timeLeft--;
        discussionTimerDisplay.textContent = `Temps restant pour le débat : ${formatTime(timeLeft)}`;
        if (timeLeft <= 0) {
            clearInterval(discussionTimerInterval);
            discussionTimerDisplay.style.display = 'none';
            forceEndDiscussionBtn.style.display = 'none';
        }
    }, 1000);
}

/**
 * Formate le temps donné en paramètre
 * @param {Time} time Le temps à formater
 * @returns Le temps rentré en paramètre, formaté en mm:ss
 */
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}


// Réception des messages de chat
socket.on('receiveMessage', receiveMessage);

// Envoi des messages de chat
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value;
    if (message) {
        socket.emit('sendMessage', { roomName, message });
        chatInput.value = '';
    }
});

// Envoi du message en appuyant sur Entrée
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click();
    }
});

// Bouton pour forcer la fin du débat
forceEndDiscussionBtn.addEventListener('click', () => {
    socket.emit('forceEndDiscussion', roomName);
});

// Fin du jeu
socket.on('gameFinished', gameFinished);

// Gestion des erreurs
socket.on('error', showError);

// Chargement d'une partie sauvegardée
loadGameBtn.addEventListener('click', () => {
    roomName = document.getElementById('loadRoomNameInput').value;
    if (roomName) {
        socket.emit('loadGame', { roomName });
    } else {
        Swal.fire('Erreur', 'Veuillez entrer un nom de salle.', 'error');
    }
});

// Confirmation du chargement de la partie
socket.on('gameLoaded', gameLoaded);

// Gestion du jeu en pause (suite à la carte "Café")
socket.on('gamePaused', gamePaused);


/* Méthodes
*/
function roomCreation(room){
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    roomNameDisplay.textContent = roomName;
}

function roomsAvailable(rooms){
    availableRoomsList.innerHTML = '';

    // Pour chaque salle disponible, créer un élément de liste avec un bouton "Rejoindre"
    rooms.forEach(roomInfo => {
        const { roomName: roomNameFromList, currentPlayers, maxPlayers } = roomInfo;
        const li = document.createElement('li');
        li.textContent = `${roomNameFromList} (${currentPlayers}/${maxPlayers} joueurs) `;

        if (currentPlayers < maxPlayers) {
            const joinButton = document.createElement('button');
            joinButton.textContent = 'Rejoindre';
            joinButton.addEventListener('click', () => {
                Swal.fire({
                    title: 'Entrez votre pseudo :',
                    input: 'text',
                    inputPlaceholder: 'Votre pseudo',
                    showCancelButton: true,
                    confirmButtonText: 'Rejoindre',
                    cancelButtonText: 'Annuler'
                }).then((result) => {
                    if (result.isConfirmed && result.value) {
                        username = result.value;
                        roomName = roomNameFromList; 
                        console.log('Tentative de rejoindre la salle :', roomName, 'avec le pseudo :', username);
                        socket.emit('joinRoom', { roomName, username });
                    }
                });
            });
            li.appendChild(joinButton);
        } else {
            const fullLabel = document.createElement('span');
            fullLabel.textContent = ' (Salle pleine)';
            li.appendChild(fullLabel);
        }

        availableRoomsList.appendChild(li);
    });
}

/**
 * Affiche le message avertissant l'utilistaeur qu'il a rejoint une salle
 */
function roomJoined(){
    console.log('Vous avez rejoint la salle :', roomName);
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    roomNameDisplay.textContent = roomName;
}

/**
 * Met à jour la liste des joueurs affichée
 * @param {Object[]} players La nouvelle liste des joueurs
 */
function updatePlayers(players){
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playersList.appendChild(li);
    });
}

/**
 * Commence le vote pour une feature
 * @param {Object} feature La feature qui sera votée
 */
function startVote(feature){
    console.log('Démarrage du vote pour la fonctionnalité :', feature.description);
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    roomNameDisplay.textContent = roomName;
    featureDescription.textContent = feature.description;
    // Réactiver les boutons de vote pour le nouveau tour
    cards.forEach(btn => btn.disabled = false);
    // Cacher le chat pendant le vote
    chatDiv.style.display = 'none';
    chatMessages.innerHTML = '';
    // Cacher le timer et le bouton de fin de discussion
    discussionTimerDisplay.style.display = 'none';
    forceEndDiscussionBtn.style.display = 'none';
}

/**
 * Affiche le message qui indique la durée estimée d'une feature suite à un vote
 * @param {Object} data Données contenant la feature et sa difficulté estimée
 */
function featureEstimated(data){
    const { feature, estimatedDifficulty } = data;
    Swal.fire('Difficulté estimée', `La fonctionnalité "${feature.description}" a été estimée à ${estimatedDifficulty}.`, 'success');
}

/**
 * Lance le vote de la fonctionnalité suivante
 * @param {Object} data Données de la salle 
 */
function revote(data){
    // Arrêter le timer
    if (discussionTimerInterval) {
        clearInterval(discussionTimerInterval);
    }
    discussionTimerDisplay.style.display = 'none';
    forceEndDiscussionBtn.style.display = 'none';
    // Afficher le message de revote
    Swal.fire('Re-vote', data.message, 'info');
    featureDescription.textContent = data.feature.description;
    // Réactiver les boutons
    cards.forEach(btn => btn.disabled = false);
    // Cacher le chat
    chatDiv.style.display = 'none';
    chatMessages.innerHTML = '';
}

/**
 * Démarre la discussion d'un vote
 * @param {Object} data Données du vote qui sera discuté
 */
function startDiscussion(data){
    const { message, extremeVotes } = data;
    Swal.fire('Discussion', `${message}\nVotes extrêmes : ${extremeVotes.lowest} et ${extremeVotes.highest}`, 'info');
    // Afficher le chat
    chatDiv.style.display = 'block';
    // Afficher le timer
    discussionTimerDisplay.style.display = 'block';
    startDiscussionTimer();
}
/**
 * Affiche le message du début de discussion
 * @param {Object} data Données du vote qui sera discuté
 */
// Notification que la discussion a commencé
function discussionStarted(data){
    const { message, extremeVotes } = data;
    Swal.fire('Discussion en cours', `${message}\nVotes extrêmes : ${extremeVotes.lowest} et ${extremeVotes.highest}`, 'info');
    // Afficher le chat
    chatDiv.style.display = 'block';
    // Afficher le timer
    discussionTimerDisplay.style.display = 'block';
    startDiscussionTimer();
    // Si le joueur est le créateur, afficher le bouton pour terminer le débat
    if (socket.id === data.creatorId) {
        forceEndDiscussionBtn.style.display = 'block';
    }
}


/**
 * Affiche un message envoyé dans le chat
 * @param {Object} data Données du message
 */
function receiveMessage(data){
    const { username: sender, message } = data;
    const p = document.createElement('p');
    p.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatMessages.appendChild(p);
    // Faire défiler vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Affiche le message de fin de jeu ainsi que le backlog du résulat des votes
 * @param {JSON} backlog Données du backlog
 */
function gameFinished(backlog){
    console.log('Jeu terminé. Backlog estimé :', backlog);
    Swal.fire('Jeu terminé', 'Le backlog a été entièrement estimé. Les résultats ont été sauvegardés.', 'success');
    resultsDiv.style.display = 'block';
    results.textContent = JSON.stringify(backlog, null, 2);
}
/**
 * Affiche un message d'erreur envoyé par le serveur
 * @param {Object} message Données du message
 */
function showError(message){
    console.error('Erreur reçue du serveur :', message);
    Swal.fire('Erreur', message, 'error');
}

/**
 * Affiche le message du chargement d'une partie dans une salle
 * @param {Object} roomData Données de la salle
 */
function gameLoaded(roomData){    
    console.log('Partie chargée :', roomData);
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    roomNameDisplay.textContent = roomName;
    Swal.fire('Partie chargée', `Partie ${roomName} chargée. Rejoignez la salle pour continuer.`, 'success');
}

/**
 * Affiche le message de mise en pause d'une partie
 * @param {string} message Données du message
 */
function gamePaused(message){
    console.log('Jeu en pause :', message);
    Swal.fire('Jeu en pause', message, 'info');
}

/**
 * Montre un message indiquant le mode de jeu
 * @param {string} message Données du message
 */
function showMessage(message){
    console.log('The gamemode :', message);
}