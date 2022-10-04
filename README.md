# Discord bot for recording meetings

### Build docker image

```shell
cd bot
DOCKER_BUILDKIT=0 docker build -t jakweg/sleepy-student .
```

### Create recordings volume

```shell
docker volume create recordings
```

### Create container

```shell
docker container create -it --name bot --volume recordings:/recordings jakweg/sleepy-student
```

### Start the bot

```shell
docker container start bot
```

### Start development environment

```shell
npm i
npm run dev
```
