# Discord bot for recording meetings on Webex or Teams

#### To start please create `.env` file inside bot directory, configure it and then run

```
RECORDINGS_PATH=/where/to/store/recordings docker-compose up --build
```

#### Configuration options inside `.env` file

|         name         |     default value      |                                                         description                                                          |
| :------------------: | :--------------------: | :--------------------------------------------------------------------------------------------------------------------------: |
|    DISCORD_TOKEN     |                        |                                            required, used to connect with Discord                                            |
|    APPLICATION_ID    |                        |                                            required, used to connect with Discord                                            |
|      TIME_ZONE       |         `GMT`          |                                            for joining scheduled meetings on time                                            |
|       LANGUAGE       |        `en-US`         |                                  for discord messages and dates, supports `en-US` and `pl`                                   |
|        WIDTH         |         `1280`         |                                               width of the recording in pixels                                               |
|        HEIGHT        |         `720`          |                                              height of the recording in pixels                                               |
|         CRF          |          `38`          |                    determines the quality of video, 1-51, 1 means high quality, 51 means small file size                     |
|      FRAMERATE       |          `4`           |                       frames per second of video, higher means bigger file sizes and better CPU needed                       |
|    AUDIO_BITRATE     |          `32`          |       determines the quality of audio in thousands, 48 is standard for most microphones, lower means smaller file size       |
|   FILENAME_FORMAT    | `%name%-%month%-%day%` |          Name of file when saving a recording, without any extension, `%name%`, `%hour%` etc. get replaced properly          |
|      WEBEX_NAME      |        `Wojtek`        |                                          name which to type when webex asks for it                                           |
|      WEBEX_MAIL      |                        |                                          mail which to type when webex asks for it                                           |
| MAX_MEETING_DURATION |          `90`          |                                duration after a recording will always be stopped, in minutes                                 |
|   ALLOWED_CHANNELS   |                        |                       comma separated list of Discord channel ids which can be used to invoke commands                       |
|    RECORDING_URL     |                        |                           url to ready recording, `%name%` gets replaced with recording file name                            |
|     TEAMS_EMAIL      |                        |                                                      email for MS Teams                                                      |
|    TEAMS_PASSWORD    |                        |                                                 password to MS Teams account                                                 |
|    TEAMS_ORIGINS     |                        | comma separated list of origins that credentials may be typed into, probably want to add `https://login.microsoftonline.com` |
