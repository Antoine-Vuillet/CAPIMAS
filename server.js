// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let rooms = {};

let turns = 0;

function getAvailableRooms() {
    return Object.keys(rooms).map(roomName => {
        const room = rooms[roomName];
        return {
            roomName,
            currentPlayers: Object.keys(room.players).length,
            maxPlayers: room.maxPlayers
        };
    });
}

io.on('connection', (socket) => {
    console.log('Utilisateur connecté :', socket.id);

    // Envoie la liste des salles disponibles au client
    socket.emit('availableRooms', getAvailableRooms());

    // Crée une salle
    socket.on('createRoom', (data)=>{
        const { roomName, maxPlayers, username, gameMode, backlog } = data;
        if (rooms[roomName]) {
            socket.emit('error', 'Une salle avec ce nom existe déjà.');
            return;
        }
        rooms[roomName] = {
            creatorId: socket.id,
            players: {},
            maxPlayers,
            gameMode,
            backlog,
            currentFeatureIndex: 0,
            votes: {},
            state: 'waiting', 
            firstRound: true,
            discussionTimer: null,
            discussionEndTime: null,
            extremes: [] 
        };
    
        // Ajoute le créateur à la liste des joueurs
        rooms[roomName].players[socket.id] = { username, hasVoted: false };
        socket.join(roomName);
        io.to(roomName).emit('updatePlayers', Object.values(rooms[roomName].players).map(p => p.username));
        socket.emit('roomCreated', roomName);
    
        // Met à jour la liste des salles disponibles pour tous les clients
        io.emit('availableRooms', getAvailableRooms());
    
        // Vérifie si la salle est pleine pour démarrer le jeu
        if (Object.keys(rooms[roomName].players).length === rooms[roomName].maxPlayers) {
            rooms[roomName].state = 'voting';
            io.to(roomName).emit('startVoting', rooms[roomName].backlog[rooms[roomName].currentFeatureIndex]);
        }
    } );

    // Rejoint une salle
    socket.on('joinRoom', (data)=>{
        const { roomName, username } = data;
        console.log('Demande de rejoindre la salle :', roomName, 'par le joueur :', username);
        const room = rooms[roomName];
        if (!room) {
            socket.emit('error', "La salle n'existe pas.");
            return;
        }
        if (Object.keys(room.players).length >= room.maxPlayers) {
            socket.emit('error', 'La salle est pleine.');
            return;
        }
        room.players[socket.id] = { username, hasVoted: false };
        socket.join(roomName);
        io.to(roomName).emit('updatePlayers', Object.values(room.players).map(p => p.username));
    
        // Émettre un événement au joueur qui vient de rejoindre
        socket.emit('roomJoined');
    
        // Met à jour la liste des salles disponibles pour tous les clients
        io.emit('availableRooms', getAvailableRooms());
    
        // Vérifie si la salle est pleine pour démarrer le jeu
        if (Object.keys(room.players).length === room.maxPlayers) {
            room.state = 'voting';
            io.to(roomName).emit('startVoting', room.backlog[room.currentFeatureIndex]);
        }
    } );

    // Reçoit un vote
    socket.on('vote',(data) =>{
        const { roomName, vote } = data;
        const room = rooms[roomName];
        if (!room) {
            console.error(`Salle non trouvée pour le vote : ${roomName}`);
            return;
        }
        const player = room.players[socket.id];
        if (!player) {
            console.error(`Joueur non trouvé dans la salle ${roomName} pour le socket ${socket.id}`);
            return;
        }
    
        player.hasVoted = true;
        room.votes[socket.id] = { username: player.username, vote };
    
        console.log(`Vote reçu de ${player.username} dans la salle ${roomName}: ${vote}`);
    
        // Vérifier si tous les joueurs ont voté
        const allVoted = Object.values(room.players).every(p => p.hasVoted);
        console.log(`Tous les joueurs ont voté dans la salle ${roomName}: ${allVoted}`);
        if (allVoted) {
            console.log(`Traitement des votes pour la salle ${roomName}`);
            handleVotingResult(roomName);
        }
    });

    // Gestion de la réception des messages de chat
    socket.on('sendMessage',(data)=>{
        const { roomName, message } = data;
        const room = rooms[roomName];
        if (!room) return;
        const player = room.players[socket.id];
        if (!player) return;
    
        // Si on est en phase de discussion, vérifier si le joueur est autorisé à envoyer des messages
        if (room.state === 'discussion') {
            if (!room.extremes.includes(socket.id)) {
                // Le joueur n'est pas autorisé à discuter
                socket.emit('error', 'Vous ne pouvez pas envoyer de messages pendant la discussion.');
                return;
            }
        }
    
        io.to(roomName).emit('receiveMessage', { username: player.username, message });
    });

    // Gestion de la fin forcée du débat par le créateur
    socket.on('forceEndDiscussion', (roomName)=>{
        const room = rooms[roomName];
        if (!room) return;
    
        if (socket.id !== room.creatorId) {
            socket.emit('error', 'Seul le créateur de la salle peut forcer la fin du débat.');
            return;
        }
    
        if (room.state !== 'discussion') {
            socket.emit('error', 'Aucun débat en cours.');
            return;
        }
    
        endDiscussion(roomName);
    });

    // Gestion de la déconnexion
    socket.on('disconnect',() =>{
        let roomDeleted = false;
    
        for (const roomName in rooms) {
            const room = rooms[roomName];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomName).emit('updatePlayers', Object.values(room.players).map(p => p.username));
    
                // Si plus de joueurs, supprime la salle
                if (Object.keys(room.players).length === 0) {
                    delete rooms[roomName];
                    roomDeleted = true;
                } else {
                    // Met à jour la liste des salles disponibles
                    io.emit('availableRooms', getAvailableRooms());
                }
                break;
            }
        }
    
        // Si une salle a été supprimée, met à jour la liste des salles disponibles
        if (roomDeleted) {
            io.emit('availableRooms', getAvailableRooms());
        }
    
        console.log('Utilisateur déconnecté :', socket.id);
    });

    // Charge une partie sauvegardée
    socket.on('loadGame', (data)=>{
        const { roomName } = data;
        fs.readFile(`saved_games/${roomName}.json`, 'utf8', (err, jsonString) => {
            if (err) {
                console.error(`Erreur lors de la lecture du fichier : ${err.message}`);
                socket.emit('error', 'Erreur lors du chargement de la partie.');
                return;
            }
            try {
                rooms[roomName] = JSON.parse(jsonString);
                socket.join(roomName);
                socket.emit('gameLoaded', rooms[roomName]);
            } catch (parseErr) {
                console.error(`Erreur lors du parsing du JSON : ${parseErr.message}`);
                socket.emit('error', 'Erreur lors du chargement de la partie (JSON invalide).');
            }
        });
    }
    );
});

// Fonction pour gérer le résultat du vote
function handleVotingResult(roomName) {
    const room = rooms[roomName];
    const votesArray = Object.values(room.votes);
    const votes = votesArray.map(v => v.vote);
    const gameMode = room.gameMode;

    console.log(`Votes pour la salle ${roomName}:`, votes);
    console.log(`Mode de jeu: ${gameMode}`);

    let decisionMade = false;
    let estimatedDifficulty = null;

    // Vérifie si tous les joueurs ont voté "Café"
    if (votes.every(v => v.toLowerCase() === 'café')) {
        // Sauvegarde l'état du jeu
        saveGame(roomName, room);
        io.to(roomName).emit('gamePaused', 'Tous les joueurs ont choisi "Café". La partie est sauvegardée.');
        return;
    }
    if(turns >0 && gameMode == "mean"){
        const somme = votes.reduce((acc, val) => acc + val, 0);
        const moyenne = somme / votes.length;
        const valeursPossibles = [1, 2, 3, 5, 8, 13, 20, 40, 100];
        const valeurLaPlusProche = valeursPossibles.reduce((plusProche, valeur) => {
            return Math.abs(valeur - moyenne) < Math.abs(plusProche - moyenne) ? valeur : plusProche;
        });
        decisionMade = true;
        estimatedDifficulty = valeurLaPlusProche;
    }else if(turns >0 && gameMode == "median"){
        votes.sort()
        const n = sortedVotes.length;
        const isPair = n % 2 === 0;
        if (!isPair) {
            return sortedVotes[Math.floor(n / 2)];
        }
        return (sortedVotes[n / 2 - 1] + sortedVotes[n / 2]) / 2;
    }else if(turns >0 && gameMode == "plurality"){
        const voteCounts = {};

        // Count votes for each option
        votes.forEach(vote => {
            voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        // Find the option with the most votes
        let pluralityOption = null;
        let maxVotes = 0;

        for (const option in voteCounts) {
            if (voteCounts[option] > maxVotes) {
                maxVotes = voteCounts[option];
                pluralityOption = option;  // Set this option as the one with the most votes
            }
        }
        decisionMade = true;
        estimatedDifficulty = pluralityOption;
    }else{
        // Vérifie si tous les votes sont identiques
        if (turns >0 && gameMode == "absmajority" && IsAbsMaj(votes)) {
            decisionMade = true;
            estimatedDifficulty = IsAbsMaj(votes);
        } else  if(votes.every(v => v === votes[0])){
            decisionMade = true;
            estimatedDifficulty = votes[0];
        }else{
            // Identifie les deux extrêmes
            const numericVotes = votesArray.filter(v => !isNaN(v.vote)).map(v => ({ ...v, vote: parseInt(v.vote), socketId: getSocketIdByUsername(roomName, v.username) }));
            if (numericVotes.length > 1) {
                const sortedVotes = numericVotes.sort((a, b) => a.vote - b.vote);
                const lowest = sortedVotes[0];
                const highest = sortedVotes[sortedVotes.length - 1];

                // Stocke les socket.id des extrêmes
                room.extremes = [lowest.socketId, highest.socketId];

                // Change l'état de la salle en 'discussion'
                room.state = 'discussion';

                // Informe les extrêmes qu'un débat est nécessaire
                io.to(lowest.socketId).emit('startDiscussion', {
                    message: `Vous êtes l'un des extrêmes (${lowest.vote}), veuillez débattre.`,
                    extremeVotes: { lowest: lowest.vote, highest: highest.vote }
                });
                io.to(highest.socketId).emit('startDiscussion', {
                    message: `Vous êtes l'un des extrêmes (${highest.vote}), veuillez débattre.`,
                    extremeVotes: { lowest: lowest.vote, highest: highest.vote }
                });

                // Informe tous les joueurs qu'un débat est en cours
                io.to(roomName).emit('discussionStarted', {
                    message: `Un débat est nécessaire entre les deux extrêmes (${lowest.vote} et ${highest.vote}).`,
                    creatorId: room.creatorId,
                    extremeVotes: { lowest: lowest.vote, highest: highest.vote }
                });

                // Démarre le timer de 2 minutes
                room.discussionEndTime = Date.now() + 2 * 60 * 1000; // 2 minutes en millisecondes
                room.discussionTimer = setTimeout(() => {
                    endDiscussion(roomName);
                }, 2 * 60 * 1000);

                // Réinitialise les votes pour le débat
                for (const playerId in room.players) {
                    room.players[playerId].hasVoted = false;
                }
                room.votes = {};
                return;
            } else {
                // Si les votes ne sont pas numériques, demande un revote
                io.to(roomName).emit('revote', {
                    feature: room.backlog[room.currentFeatureIndex],
                    message: 'Votes non valides, veuillez revoter.'
                });
                // Réinitialise les votes
                for (const playerId in room.players) {
                    room.players[playerId].hasVoted = false;
                }
                room.votes = {};
                return;
            }
        }
    }

    

    if (decisionMade) {
        console.log(`Décision prise pour la salle ${roomName}: Difficulté estimée = ${estimatedDifficulty}`);

        // Enregistre la difficulté estimée
        room.backlog[room.currentFeatureIndex].estimatedDifficulty = estimatedDifficulty;

        // Informe les joueurs de la difficulté votée
        io.to(roomName).emit('featureEstimated', {
            feature: room.backlog[room.currentFeatureIndex],
            estimatedDifficulty
        });

        // Passe à la fonctionnalité suivante
        room.currentFeatureIndex++;
        if (room.currentFeatureIndex >= room.backlog.length) {
            room.state = 'finished';
            io.to(roomName).emit('gameFinished', room.backlog);
            saveResults(roomName, room.backlog);
        } else {
            // Réinitialise pour la prochaine fonctionnalité
            room.votes = {};
            for (const playerId in room.players) {
                room.players[playerId].hasVoted = false;
            }
            room.firstRound = true;
            room.state = 'voting';
            // Démarrer le vote pour la prochaine fonctionnalité après un petit délai
            setTimeout(() => {
                io.to(roomName).emit('startVoting', room.backlog[room.currentFeatureIndex]);
            }, 2000); // 2 secondes de délai
        }
    }
}

function IsAbsMaj(votes) {
    const voteCounts = {};

    votes.forEach(vote => {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    const totalVotes = votes.length;
    const majorityThreshold = totalVotes / 2;

    for (const option in voteCounts) {
        if (voteCounts[option] > majorityThreshold) {
            return option;
        }
    }

    return null;  // No absolute majority
}


// Fonction pour terminer le débat et lancer le revote
function endDiscussion(roomName) {
    const room = rooms[roomName];
    if (!room) return;

    // Annule le timer s'il est encore actif
    if (room.discussionTimer) {
        clearTimeout(room.discussionTimer);
        room.discussionTimer = null;
    }

    // Réinitialise les extrêmes
    room.extremes = [];

    // Change l'état de la salle en 'voting'
    room.state = 'voting';

    // Informe tous les joueurs que le revote commence
    io.to(roomName).emit('revote', { feature: room.backlog[room.currentFeatureIndex], message: 'Le débat est terminé, veuillez revoter.' });
}

// Fonction pour obtenir le socketId d'un joueur à partir de son pseudo
function getSocketIdByUsername(roomName, username) {
    const room = rooms[roomName];
    for (const socketId in room.players) {
        if (room.players[socketId].username === username) {
            return socketId;
        }
    }
    return null;
}

// Fonction pour sauvegarder la partie
function saveGame(roomName, roomData) {
    const dir = 'saved_games';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    fs.writeFile(`${dir}/${roomName}.json`, JSON.stringify(roomData, null, 2), (err) => {
        if (err) {
            console.error('Erreur lors de la sauvegarde de la partie :', err.message);
        } else {
            console.log(`Partie sauvegardée pour la salle ${roomName}`);
        }
    });
}

// Fonction pour sauvegarder les résultats
function saveResults(roomName, backlog) {
    const dir = 'results';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    fs.writeFile(`${dir}/${roomName}_results.json`, JSON.stringify(backlog, null, 2), (err) => {
        if (err) {
            console.error('Erreur lors de la sauvegarde des résultats :', err.message);
        } else {
            console.log(`Résultats sauvegardés pour la salle ${roomName}`);
        }
    });
}

function createRoom(data){
    const { roomName, maxPlayers, username, gameMode, backlog } = data;
    if (rooms[roomName]) {
        socket.emit('error', 'Une salle avec ce nom existe déjà.');
        return;
    }
    rooms[roomName] = {
        creatorId: socket.id,
        players: {},
        maxPlayers,
        gameMode,
        backlog,
        currentFeatureIndex: 0,
        votes: {},
        state: 'waiting', 
        firstRound: true,
        discussionTimer: null,
        discussionEndTime: null,
        extremes: [] 
    };

    // Ajoute le créateur à la liste des joueurs
    rooms[roomName].players[socket.id] = { username, hasVoted: false };
    socket.join(roomName);
    io.to(roomName).emit('updatePlayers', Object.values(rooms[roomName].players).map(p => p.username));
    socket.emit('roomCreated', roomName);

    // Met à jour la liste des salles disponibles pour tous les clients
    io.emit('availableRooms', getAvailableRooms());

    // Vérifie si la salle est pleine pour démarrer le jeu
    if (Object.keys(rooms[roomName].players).length === rooms[roomName].maxPlayers) {
        rooms[roomName].state = 'voting';
        io.to(roomName).emit('startVoting', rooms[roomName].backlog[rooms[roomName].currentFeatureIndex]);
    }
}

function loadGame(data){
    const { roomName } = data;
    fs.readFile(`saved_games/${roomName}.json`, 'utf8', (err, jsonString) => {
        if (err) {
            console.error(`Erreur lors de la lecture du fichier : ${err.message}`);
            socket.emit('error', 'Erreur lors du chargement de la partie.');
            return;
        }
        try {
            rooms[roomName] = JSON.parse(jsonString);
            socket.join(roomName);
            socket.emit('gameLoaded', rooms[roomName]);
        } catch (parseErr) {
            console.error(`Erreur lors du parsing du JSON : ${parseErr.message}`);
            socket.emit('error', 'Erreur lors du chargement de la partie (JSON invalide).');
        }
    });
}

const PORT = 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));
