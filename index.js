require("dotenv").config();
const express = require("express");
const axios = require("axios");
const tmi = require("tmi.js");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 80;

// Define allowed origins
const allowedOrigins = ["http://localhost:80", process.env.REDIRECT_URI];

// CORS middleware configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

// Use CORS middleware
app.use(cors(corsOptions));
app.use(express.json());

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let spotifyAccessToken = "";
let spotifyRefreshToken = "";
let twitchAccessToken = "";
let twitchRefreshToken = "";
let lastSong = "";
let isBotRunning = false;
let botInterval = null;
let twitchClient = null;

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
      `${process.env.REDIRECT_URI}/callback`
    )}&scope=user-read-currently-playing`
  );
});

app.get("/authorize-twitch", (req, res) => {
  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      `${process.env.REDIRECT_URI}/callback-twitch`
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
      redirect_uri: `${process.env.REDIRECT_URI}/callback`,
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
      `${process.env.REDIRECT_URI}/callback-twitch`
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

app.post("/verify-password", (req, res) => {
  const { password } = req.body;
  if (password === process.env.BOT_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

app.get("/toggle-bot", async (req, res) => {
  const twitchChannel = req.query.channel;
  if (!twitchChannel) {
    return res.status(400).json({ message: "Twitch channel is required." });
  }

  if (!spotifyAccessToken || !twitchAccessToken) {
    return res
      .status(400)
      .json({ message: "Both Spotify and Twitch must be authorized." });
  }

  if (!isBotRunning) {
    twitchClient = new tmi.Client({
      options: { debug: false },
      connection: {
        reconnect: true,
      },
      identity: {
        username: twitchChannel,
        password: `oauth:${twitchAccessToken}`,
      },
      channels: [twitchChannel],
    });

    await twitchClient.connect();

    botInterval = setInterval(async () => {
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
        console.log("Spotify response:", response.status);

        if (response.status === 200) {
          const data = response.data;
          const song = `${data.item.name} by ${data.item.artists
            .map((artist) => artist.name)
            .join(", ")}`;
          if (song !== lastSong) {
            console.log(`Sending message to Twitch chat: Now playing: ${song}`);
            await twitchClient.say(twitchChannel, `Now playing: ${song}`);
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

    isBotRunning = true;
    res.json({
      message: "Bot is running!",
      isRunning: true,
      channel: twitchChannel,
    });
  } else {
    if (twitchClient) {
      twitchClient.disconnect();
    }
    clearInterval(botInterval);
    isBotRunning = false;
    res.json({ message: "Bot is stopped", isRunning: false, channel: "" });
  }
});

app.get("/botStatus", (req, res) => {
  res.json({
    message: isBotRunning ? "Bot is running!" : "Bot is stopped",
    isRunning: isBotRunning,
    channel: isBotRunning ? twitchClient.getChannels()[0] : "",
  });
});

app.listen(port, () => {
  console.log(`Server is running on ${process.env.REDIRECT_URI}:${port}`);
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
