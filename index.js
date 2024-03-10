require("dotenv").config();
const express = require("express");
const axios = require("axios");
const tmi = require("tmi.js");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 80;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL;

let spotifyAccessToken = "";
let spotifyRefreshToken = "";
let twitchAccessToken = "";
let twitchRefreshToken = "";
let lastSong = "";

// Load tokens from file
try {
  const tokens = JSON.parse(
    fs.readFileSync(path.join(__dirname, "tokens.json"), "utf8")
  );
  spotifyAccessToken = tokens.spotifyAccessToken;
  spotifyRefreshToken = tokens.spotifyRefreshToken;
  twitchAccessToken = tokens.twitchAccessToken;
  twitchRefreshToken = tokens.twitchRefreshToken;
} catch (error) {
  console.log("No previous tokens found or failed to load them.");
}

app.use(express.static("public"));

app.get("/authorize-spotify", (req, res) => {
  res.redirect(
    `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
      "http://localhost/callback"
    )}&scope=user-read-currently-playing`
  );
});

app.get("/authorize-twitch", (req, res) => {
  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      "http://localhost/callback-twitch"
    )}&response_type=code&scope=chat:edit+chat:read`
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "http://localhost/callback",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
    }
  );

  spotifyAccessToken = response.data.access_token;
  spotifyRefreshToken = response.data.refresh_token;
  fs.writeFileSync(
    path.join(__dirname, "public", "spotifyStatus.txt"),
    "Spotify Authorized"
  );
  saveTokens();
  res.redirect("/");
});

app.get("/callback-twitch", async (req, res) => {
  const code = req.query.code;
  const response = await axios.post(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(
      "http://localhost/callback-twitch"
    )}`
  );
  twitchAccessToken = response.data.access_token;
  twitchRefreshToken = response.data.refresh_token;
  fs.writeFileSync(
    path.join(__dirname, "public", "twitchStatus.txt"),
    "Twitch Authorized"
  );
  saveTokens();
  res.redirect("/");
});

app.get("/run-bot", async (req, res) => {
  if (!spotifyAccessToken || !twitchAccessToken) {
    return res.status(400).send("Both Spotify and Twitch must be authorized.");
  }

  const twitchClient = new tmi.Client({
    options: { debug: false },
    connection: {
      reconnect: true,
    },
    identity: {
      username: TWITCH_CHANNEL,
      password: `oauth:${twitchAccessToken}`,
    },
    channels: [TWITCH_CHANNEL],
  });

  await twitchClient.connect();

  setInterval(async () => {
    try {
      console.log("Checking Spotify for currently playing song...");
      const response = await axios.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        {
          headers: {
            Authorization: `Bearer ${spotifyAccessToken}`,
          },
        }
      );
      console.log("Spotify response:", response.status, response.data);

      if (response.status === 200) {
        const data = response.data;
        const song = `${data.item.name} by ${data.item.artists
          .map((artist) => artist.name)
          .join(", ")}`;
        if (song !== lastSong) {
          console.log(`Sending message to Twitch chat: Now playing: ${song}`);
          await twitchClient.say(TWITCH_CHANNEL, `Now playing: ${song}`);
          lastSong = song;
        }
      }
    } catch (error) {
      console.error("Error fetching current song:", error);
      if (error.response && error.response.status === 401) {
        // Spotify Access token expired, refresh it
        const response = await axios.post(
          "https://accounts.spotify.com/api/token",
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: spotifyRefreshToken,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(
                `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
              ).toString("base64")}`,
            },
          }
        );

        spotifyAccessToken = response.data.access_token;
        saveTokens();
      } else {
        console.error("Error fetching current song:", error);
      }
    }

    try {
      // Test Twitch token
      await axios.get(`https://api.twitch.tv/helix/users`, {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${twitchAccessToken}`,
        },
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Twitch Access token expired, refresh it
        const response = await axios.post(
          `https://id.twitch.tv/oauth2/token`,
          new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: twitchRefreshToken,
          })
        );

        twitchAccessToken = response.data.access_token;
        twitchRefreshToken = response.data.refresh_token;
        saveTokens();
      } else {
        console.error("Error testing Twitch token:", error);
      }
    }
  }, 10000);

  res.send("Bot is running!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Function to save tokens to file
function saveTokens() {
  const tokens = {
    spotifyAccessToken,
    spotifyRefreshToken,
    twitchAccessToken,
    twitchRefreshToken,
  };
  fs.writeFileSync(path.join(__dirname, "tokens.json"), JSON.stringify(tokens));
}
