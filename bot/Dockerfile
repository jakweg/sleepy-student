FROM --platform=linux/amd64 node:20
WORKDIR /usr/src/app
RUN apt update
RUN apt-get install -y wget
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get install ./google-chrome-stable_current_amd64.deb -y
RUN apt install novnc x11vnc scrot xdotool libtool automake autoconf libsodium-dev libsodium23 xvfb libgbm1 gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release pulseaudio libpulse-dev ffmpeg -y
COPY package*.json ./
RUN npm config set strict-ssl false
RUN npm install
COPY . .
COPY .env .env
RUN npm run build
CMD ["npm", "run", "start"]
