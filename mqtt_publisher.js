const client = require("mqtt").connect("mqtt://ec2-13-233-27-3.ap-south-1.compute.amazonaws.com:1883");
client.on("connect", function () {
    console.log("Connected to Broker");
});
module.exports = client;