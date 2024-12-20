# CAPIMAS

Capimas is a planning poker application, focusing on the functionality implemented in `script.js`. The application facilitates collaborative estimation of feature complexity through real-time interaction using **Socket.IO**.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Setup Instructions](#setup-instructions)
4. [Usage](#usage)
5. [Socket.IO Events](#socketio-events)
6. [Error Handling](#error-handling)
7. [Contribution Guidelines](#contribution-guidelines)
8. [License](#license)

---

## Overview

This Planning Poker application allows teams to estimate the complexity of features collaboratively. It includes functionalities like room management, voting, chat discussions, and real-time synchronization. The client-side script, `script.js`, manages user interaction, event handling, and communication with the server.

---

## Features

- **Room Management**: Create, join, or list available rooms.
- **Voting System**: Vote on the complexity of features using predefined cards.
- **Chat System**: Exchange messages during discussions.
- **Timer Functionality**: Monitor discussion time with a countdown timer.
- **Backlog Management**: Load a backlog JSON file and estimate feature complexity.
- **Real-Time Updates**: Live updates for player actions, voting progress, and room status.
- **Game Modes**: Support for different estimation calculation methods (e.g., mean, median).
- **Error Handling**: User-friendly alerts for invalid inputs or server errors.

---

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher recommended)
- Socket.IO server running (refer to `server.js` implementation)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
   cd planning-poker
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   node server.js
   ```

5. Open the client in your browser by navigating to `http://localhost:3000` (default).

---

## Usage

### Creating a Room
1. Enter room details (name, maximum players, username, game mode).
2. Select a backlog JSON file.
3. Click **Create Room**.

### Joining a Room
1. View available rooms in the lobby.
2. Click **Join** for the desired room.
3. Enter your username and confirm.

### Voting
1. Select a card to vote on the complexity of the current feature.
2. If there's disagreement, participate in the discussion and re-vote.

### Chat
- Use the chat input to send messages to other players during the discussion phase.

### Timer
- A countdown timer displays the remaining time for discussions.

### Loading a Game
1. Enter the name of the saved room.
2. Click **Load Game** to restore the game state.

---

## Socket.IO Events

### Emitted Events
- **createRoom**: Creates a new room with specified parameters.
- **joinRoom**: Joins an existing room.
- **vote**: Submits a player's vote.
- **sendMessage**: Sends a chat message.
- **forceEndDiscussion**: Ends the discussion phase (creator only).
- **loadGame**: Loads a saved game state.

### Received Events
- **roomCreated**: Confirms successful room creation.
- **availableRooms**: Updates the list of available rooms.
- **roomJoined**: Confirms successful room join.
- **updatePlayers**: Updates the list of players in a room.
- **startVoting**: Initiates the voting phase for a feature.
- **featureEstimated**: Displays the estimated complexity for a feature.
- **revote**: Prompts players to re-vote after a discussion.
- **startDiscussion**: Begins the discussion phase with extreme votes highlighted.
- **discussionStarted**: Notifies players of the ongoing discussion.
- **receiveMessage**: Appends a chat message to the chat window.
- **gameFinished**: Signals the end of the game and displays results.
- **gameLoaded**: Confirms successful game state restoration.
- **gamePaused**: Notifies players of a paused game state.
- **error**: Displays an error message.

---

## Error Handling

- **Input Validation**: Ensures all required fields are filled before emitting events.
- **Server Errors**: Displays friendly messages using SweetAlert2 for issues like room unavailability or invalid votes.
- **Client-Side Errors**: Logs errors to the console and displays appropriate alerts.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments

- **SweetAlert2**: Used for enhanced alerts and modals.
- **Socket.IO**: Provides real-time communication capabilities.

---

