# TuneStreamerBot

A bot that announces the current song playing on Spotify in a Twitch chat.

## Setup

### Prerequisites

- A Spotify Developer account and a registered Spotify application to access the Spotify API.
- A Twitch account and a registered Twitch application to access the Twitch API.
- Node.js installed on your machine.

### Step 1: Clone the Repository

Clone this repository to your local machine and navigate to the project directory:

```bash
git clone https://github.com/yourusername/TuneStreamerBot.git
cd TuneStreamerBot
``` 

### Step 2: Install Dependencies

Install the necessary dependencies by running:
```
npm install
``` 

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory of the project with the following content:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_CHANNEL=your_twitch_channel
``` 

Replace the placeholders with your actual credentials:

-   `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`: Obtained from your Spotify Developer Dashboard.
-   `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`: Obtained from your Twitch Developer Console.
-   `TWITCH_CHANNEL`: The name of the Twitch channel where the bot will announce the current song. This can be your channel or any other channel where you have permission to send messages.

### Step 4 Run the Bot

`node index` 

The bot will now start running and will announce the current song playing on Spotify in the specified Twitch chat every 10 seconds.

## Usage

Make sure you are playing a song on Spotify and have the bot running. The bot will automatically announce the current song in the Twitch chat at regular intervals.

## Notes

-   You need to have permission to send messages in the Twitch channel you specify. If you're using someone else's channel, make sure you have their consent and the necessary permissions.
-   The bot uses polling to check for song changes on Spotify, which means there might be a slight delay between the song change and the announcement in Twitch chat.
-   If you encounter any issues or have suggestions for improvement, feel free to open an issue or submit a pull request on the repository.