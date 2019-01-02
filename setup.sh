#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
apt-get -y update
apt-get -y install git
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
apt-get install -y nodejs
npm i -g pino-papertrail pino-pretty pm2
cd /home/ubuntu
git clone https://github.com/DirtboxDemon/Spectrum.git
cd Spectrum
curl https://i9sfw3k3wf.execute-api.ap-south-1.amazonaws.com/latest/spectrum/tcp_server -o config.json
npm install
pm2 start --name "Device TCP Server" index.js | pino-pretty