#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
# crontab -l | { cat; echo "@reboot pm2 start /home/${USER}/spectrum/index.js --name \"Device-Broker\"" | pino-pretty ; } | crontab -
apt-get -y update
apt-get -y install git
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
apt-get install -y nodejs
npm i -g pino-papertrail pino-pretty pm2
echo "machine bitbucket.org" >> /home/ubuntu/.netrc
echo "login dirtboxdemon" >> /home/ubuntu/.netrc
echo "password d!r8b0ks-Dem09" >> /home/ubuntu/.netrc
cd /home/ubuntu
git clone https://dirtboxdemon@bitbucket.org/intuginedev/spectrum.git
cd spectrum
npm install
pm2 start --name "Device Broker" index.js | pino-pretty