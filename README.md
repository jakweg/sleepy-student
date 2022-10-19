# Discord bot for recording meetings on Webex or Teams

#### To start please create `.env` file inside bot directory, configure it and then run

```
RECORDINGS_PATH=/where/to/store/recordings docker-compose up --build
```

#### Configuration options inside `.env` file

|             name              | default value |                                                         description                                                          |
| :---------------------------: | :-----------: | :--------------------------------------------------------------------------------------------------------------------------: |
|         DISCORD_TOKEN         |               |                                            required, used to connect with Discord                                            |
|        APPLICATION_ID         |               |                                            required, used to connect with Discord                                            |
|           TIME_ZONE           |     `GMT`     |                                            for joining scheduled meetings on time                                            |
|            LOCALE             |     `en`      |                                                     for dates formatting                                                     |
|             WIDTH             |    `1280`     |                                               width of the recording in pixels                                               |
|            HEIGHT             |     `720`     |                                              height of the recording in pixels                                               |
|          WEBEX_NAME           |   `Wojtek`    |                                          name which to type when webex asks for it                                           |
|          WEBEX_MAIL           |               |                                          mail which to type when webex asks for it                                           |
| MAX_MEETING_DURATION_MINUTES  |     `90`      |                                duration after a recording will always be stopped, in minutes                                 |
|       ALLOWED_CHANNELS        |               |                       comma separated list of Discord channel ids which can be used to invoke commands                       |
|  RECORDING_READY_URL_FORMAT   |               |                           url to ready recording, `%name%` gets replaced with recording file name                            |
|  MS_TEAMS_CREDENTIALS_LOGIN   |               |                                                     your MS Teams email                                                      |
| MS_TEAMS_CREDENTIALS_PASSWORD |               |                                                    your MS Teams password                                                    |
| MS_TEAMS_CREDENTIALS_ORIGINS  |               | comma separated list of origins that credentials may be typed into, probably want to add `https://login.microsoftonline.com` |
