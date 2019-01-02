const net = require('net'),
    mongo = require('@intugine-technologies/mongodb'),
    spectrum = require('@intugine-technologies/spectrum');
let db = null;
const parse_data = (data) => {
    if (data.indexOf('@@') > -1){
        try{
        	const temp = spectrum(data).map(i => {
        		return Object.assign({}, i, cellTower: [i.cellTower[0], i.cellTower[1], parseInt(i.cellTower[2]).toString(16), parseInt(i.cellTower[3]).toString(16)]);
        	});
            return temp;
        } catch(e){
            return data;
        }
    } else return data;
};

const geolocation = (cell) => axios({
    url: `https://8cwv222cy1.execute-api.ap-south-1.amazonaws.com/latest/api/v1/${cell[0]}/${cell[1]}/${cell[2]}/${cell[3]}`,
    method: 'GET'
});

const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.on('end', () => {
        console.log('Client disconnected');
    });
    socket.on('data', (data) => {
        const parsed_data = parse_data(data)
        if(Array.isArray(parsed_data) && parsed_data.length > 0){        
            if(parsed_data.filter(i => !i.gps[0]).length > 0){
                console.log('Need to fetch cellTower', parsed_data[0].imei)
                Promise.all(parsed_data.map(i => geolocation(i.cellTower)))
                    .then((r) => {
                        r.forEach((i, index) => {
                            if(i.data){                    
                                parsed_data[index].gsm = [i.data.location.lat, i.data.location.lng]
                            }
                        })
                    })
                    .catch((e) => {
                        console.error('Some error in fetching the celltower data', e && e.response ? e.response.data : e)
                    })
                    .finally(() => {
                        add_data(parsed_data);
                    })
            } else {
                add_data(parsed_data)
            };
        } else console.error('Some error in parsing data', data)
    });
    socket.once('close', () => {
        // console.log(`Connection closed with ${socket.remoteAddress}:${socket.remotePort}`)
    });
    socket.on('error', (err) => {
        // console.log(`Connection error with ${err}`);
    });
    // socket.pipe(socket);
});

server.on('error', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason.stack || reason)
})
const add_data = (data) => {
    if (!Array.isArray(data) && typeof(data) !== 'object') data = [{ data }]
    if (data[0] && data[0].imei) {
        db.read('devices', { imei: data[0].imei }, 1)
            .then((r) => {
                if (r[0]) {
                    data = data.map(i => ({ ...i, device: r[0].id }))
                    if (r[0].client) {
                        mqtt_publisher.publish(r[0].client, JSON.stringify(data))
                    } else {
                        console.log(r[0].id, 'No subscribing client for data')
                    }
                } else {
                    console.log('Device not mapped', r[0].imei)
                    data = data.map(i => ({ ...i, device: "NA" }))
                }
            })
            .catch((e) => {
                data = data.map(i => ({ ...i, device: "NA" }))
            })
            .finally(() => {
                return db.create('data', data)
            })
            .then((r) => {
                // console.log('Data inserted');
            })
            .catch((e) => {
                console.error('Error in pushing data to DB', e);
            })
    } else {
        console.error(data)
    }
    return;
}
mongo(config.DB_URI, config.SPECTRUM_DB_NAME)
    .then((DB) => {
        db = DB;
        console.log('SPECTRUM_SERVER Connected to DB');
        server.listen(config.SPECTRUM_TCP_SERVER_PORT, () => {
            console.log('SPECTRUM_TCP_SERVER Listening on', config.SPECTRUM_TCP_SERVER_PORT);
        });
    })
    .catch((e) => {
        console.error('Error in connecting to DB', e)
    })
