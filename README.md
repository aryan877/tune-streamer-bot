
## TuneStreamerBot Setup

A bot that announces the current song playing on Spotify in a Twitch chat.

### Prerequisites

-   Spotify Developer account and registered application.
-   Twitch account and registered application.
-   Node.js installed on your machine.

### Setup Instructions

1.  **Clone the Repository:**
    
```
git clone https://github.com/aryan877/tune-streamer-bot
cd tune-streamer-bot
``` 
    
2.  **Install Dependencies:**
    
     `npm install` 
    
3.  **Configure Environment Variables:** Create a `.env` file in the project root with your credentials:
    

 ```
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
    TWITCH_CLIENT_ID=your_twitch_client_id
    TWITCH_CLIENT_SECRET=your_twitch_client_secret
    TWITCH_CHANNEL=your_twitch_channel
```
    
4.  **Run the Bot:**
    
    `node index.js` 
    
The bot will announce the current song playing on Spotify in the specified Twitch chat every 10 seconds.

### Notes

-   Ensure you have permission to send messages in the Twitch channel.
-   There might be a slight delay between the song change and the announcement due to polling.
-   For issues or suggestions, feel free to contribute to the repository.